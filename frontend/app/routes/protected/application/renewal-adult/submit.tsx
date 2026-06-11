import { data, redirect, useFetcher } from 'react-router';

import { UTCDate } from '@date-fns/utc';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/submit';

import { TYPES } from '~/.server/constants';
import { loadProtectedApplicationRenewalAdultStateForReview } from '~/.server/routes/helpers/protected-application-renewal-adult-route-helpers';
import { clearProtectedApplicationState, saveProtectedApplicationState, shouldSkipMaritalStatus, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DebugPayload } from '~/components/debug-payload';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputCheckbox } from '~/components/input-checkbox';
import { LoadingButton } from '~/components/loading-button';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { useHCaptchaFetcherSubmit } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/protected/application/renewal-adult/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const CHECKBOX_VALUE = {
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalAdult.submit,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context: { appContainer, session }, request, params }: Route.LoaderArgs) {
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalAdultStateForReview({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-adult']);

  const t = await getFixedT(request, ['protectedApplicationRenewalAdult', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.submit.pageTitle) }),
  };

  const { ENABLED_FEATURES } = appContainer.get(TYPES.ClientConfig);

  const viewPayloadEnabled = ENABLED_FEATURES.includes('view-payload');
  const userInfoToken = session.get('userInfoToken');
  const benefitApplicationDtoMapper = appContainer.get(TYPES.BenefitRenewalDtoMapper);
  const benefitApplicationStateMapper = appContainer.get(TYPES.BenefitRenewalStateMapper);
  const benefitRenewalDto = viewPayloadEnabled && benefitApplicationStateMapper.mapBenefitRenewalAdultStateToBenefitRenewalDto(state, userInfoToken.sub);
  const payload = benefitRenewalDto && benefitApplicationDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitRenewalDto, 'protected');

  return {
    state: {
      applicantName: `${state.clientApplication.applicantInformation.firstName} ${state.clientApplication.applicantInformation.lastName}`,
    },
    shouldSkipMaritalStatusStep: shouldSkipMaritalStatus(state),
    meta,
    payload,
  };
}

export async function action({ context: { appContainer, session }, request, params }: Route.ActionArgs) {
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalAdultStateForReview({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-adult']);

  const formData = await request.formData();
  const t = await getFixedT(request, 'protectedApplicationRenewalAdult');

  securityHandler.validateCsrfToken({ formData, session });
  await securityHandler.validateHCaptchaResponse({ formData, request }, () => {
    clearProtectedApplicationState({ params, session });
    throw redirect(getPathById('protected/unable-to-process-request', params));
  });

  const submitTermsSchema = z.object({
    acknowledgeInfo: z.literal(true, {
      error: t(($) => $.submit.errorMessage.acknowledgeInfoRequired),
    }),
    acknowledgeCriteria: z.literal(true, {
      error: t(($) => $.submit.errorMessage.acknowledgeCriteriaRequired),
    }),
  });

  const parsedDataResult = submitTermsSchema.safeParse({
    acknowledgeInfo: formData.get('acknowledgeInfo')?.toString() === CHECKBOX_VALUE.yes,
    acknowledgeCriteria: formData.get('acknowledgeCriteria')?.toString() === CHECKBOX_VALUE.yes,
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  const userInfoToken = session.get('userInfoToken');
  const benefitApplicationDto = appContainer.get(TYPES.BenefitRenewalStateMapper).mapBenefitRenewalAdultStateToBenefitRenewalDto(state, userInfoToken.sub);
  const confirmationCode = await appContainer.get(TYPES.BenefitRenewalService).createProtectedBenefitRenewal(benefitApplicationDto);
  const submissionInfo = { confirmationCode, submittedOn: new UTCDate().toISOString() };
  saveProtectedApplicationState({ params, session, state: { submitTerms: parsedDataResult.data, submissionInfo } });

  return redirect(getPathById('protected/application/$id/renewal-adult/confirmation', params));
}

export default function ProtectedNewAdultSubmit({ loaderData, params }: Route.ComponentProps) {
  const { state, payload, shouldSkipMaritalStatusStep } = loaderData;
  const { t } = useTranslation('protectedApplicationRenewalAdult');
  const fetcher = useFetcher<typeof action>();
  const errors = fetcher.data?.errors;

  const { handleSubmit, hCaptchaEnabled, hCaptchaOnLoad, hCaptchaRef, hCaptchaSitekey, isSubmitting } = useHCaptchaFetcherSubmit(fetcher);

  const eligibilityLink = <InlineLink to={t(($) => $.submit.doYouQualifyHref)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.submit.pageHeading)}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <ProgressStepper activeStep="submit" excludeMaritalStatus={shouldSkipMaritalStatusStep} className="mb-8" />
        <div className="max-w-prose space-y-8">
          <ErrorSummary />
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.overview)}</h2>
              <div className="space-y-4">
                <p>{t(($) => $.submit.youAreSubmitting)}</p>
                <ul className="list-disc space-y-1 pl-7">
                  <li>{state.applicantName}</li>
                </ul>
              </div>
            </section>
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.reviewYourApplication)}</h2>
              <p>{t(($) => $.submit.pleaseReview)}</p>
              <ButtonLink variant="primary" routeId="protected/application/$id/renew" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Adult:Action click">
                {t(($) => $.submit.reviewApplication)}
              </ButtonLink>
            </section>
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.submitYourApplication)}</h2>
              <p>{t(($) => $.submit.bySubmitting)}</p>
              <p>
                <Trans ns="protectedApplicationRenewalAdult" i18nKey={($) => $.submit.reviewEligibilityCriteria} components={{ eligibilityLink }} />
              </p>
              <fetcher.Form method="post" onSubmit={handleSubmit} noValidate>
                <CsrfTokenInput />
                {hCaptchaEnabled && <HCaptcha size="invisible" sitekey={hCaptchaSitekey} ref={hCaptchaRef} onLoad={hCaptchaOnLoad} />}
                <div className="space-y-2">
                  <InputCheckbox id="acknowledge-info" name="acknowledgeInfo" value={CHECKBOX_VALUE.yes} errorMessage={errors?.acknowledgeInfo} required>
                    {t(($) => $.submit.infoIsCorrect)}
                  </InputCheckbox>
                  <InputCheckbox id="acknowledge-criteria" name="acknowledgeCriteria" value={CHECKBOX_VALUE.yes} errorMessage={errors?.acknowledgeCriteria} required>
                    {t(($) => $.submit.iUnderstand)}
                  </InputCheckbox>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_170px]">
                  <LoadingButton loading={isSubmitting} variant="green" className="order-first h-full text-base sm:order-last sm:text-lg" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Adult:Submit click">
                    {t(($) => $.submit.submit)}
                  </LoadingButton>
                  <NavigationButtonLink
                    disabled={isSubmitting}
                    variant="secondary"
                    direction="previous"
                    routeId="protected/application/$id/renewal-adult/dental-insurance"
                    params={params}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Adult:Back click"
                  >
                    {t(($) => $.submit.dentalInsurance)}
                  </NavigationButtonLink>
                </div>
              </fetcher.Form>
            </section>
          </div>
          <div className="mt-8">
            <InlineLink routeId="protected/application/$id/renewal-adult/exit-application" params={params}>
              {t(($) => $.submit.exitApplication)}
            </InlineLink>
          </div>
        </div>
        {payload && (
          <div className="mt-8">
            <DebugPayload data={payload} enableCopy />
          </div>
        )}
      </ErrorSummaryProvider>
    </>
  );
}
