import { data, redirect, useFetcher } from 'react-router';

import { UTCDate } from '@date-fns/utc';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/submit';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearPublicApplicationState, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { loadPublicApplicationSimplifiedChildStateForReview } from '~/.server/routes/helpers/public-application-simplified-child-route-helpers';
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
import { useFetcherSubmissionState, useHCaptcha } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useFeature } from '~/root';
import { ProgressStepper } from '~/routes/public/application/simplified-children/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const CHECKBOX_VALUE = {
  yes: 'yes',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.application.simplifiedChild.submit,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedChildStateForReview({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-children']);

  const t = await getFixedT(url, ['applicationSimplifiedChild', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.submit.pageTitle) }),
  };

  const children = state.children.map((child) => ({
    id: child.id,
    name: `${child.information.firstName} ${child.information.lastName}`,
  }));

  const { ENABLED_FEATURES } = appContainer.get(TYPES.ClientConfig);

  const viewPayloadEnabled = ENABLED_FEATURES.includes('view-payload');
  const benefitApplicationDtoMapper = appContainer.get(TYPES.BenefitRenewalDtoMapper);
  const benefitApplicationStateMapper = appContainer.get(TYPES.BenefitRenewalStateMapper);
  const benefitApplicationDto = viewPayloadEnabled && benefitApplicationStateMapper.mapBenefitRenewalChildStateToBenefitRenewalDto(state);
  const payload = benefitApplicationDto && benefitApplicationDtoMapper.mapBenefitRenewalDtoToBenefitRenewalRequestEntity(benefitApplicationDto);

  return {
    state: {
      children,
    },
    meta,
    payload,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedChildStateForReview({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-children']);

  const formData = await request.formData();
  const t = await getFixedT(url, 'applicationSimplifiedChild');

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });
  await securityHandler.validateHCaptchaResponse({ formData, request }, () => {
    clearPublicApplicationState({ params, session });
    throw redirect(getPathById('public/unable-to-process-request', params));
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

  const benefitApplicationDto = appContainer.get(TYPES.BenefitRenewalStateMapper).mapBenefitRenewalChildStateToBenefitRenewalDto(state);
  const confirmationCode = await appContainer.get(TYPES.BenefitRenewalService).createPublicBenefitRenewal(benefitApplicationDto);
  const submissionInfo = { confirmationCode, submittedOn: new UTCDate().toISOString() };
  savePublicApplicationState({ params, session, state: { submitTerms: parsedDataResult.data, submissionInfo } });

  return redirect(getPathById('public/application/$id/simplified-children/confirmation', params));
}

export default function RenewChildrenSubmit({ loaderData, params }: Route.ComponentProps) {
  const { state, payload } = loaderData;
  const { t } = useTranslation('applicationSimplifiedChild');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  const hCaptchaEnabled = useFeature('hcaptcha');
  const { captchaRef, onLoad, sitekey } = useHCaptcha();

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    if (hCaptchaEnabled && captchaRef.current) {
      try {
        const response = captchaRef.current.getResponse();
        formData.set('h-captcha-response', response);
      } catch {
        /* intentionally ignore and proceed with submission */
      } finally {
        captchaRef.current.resetCaptcha();
      }
    }

    await fetcher.submit(formData, { method: 'POST' });
  }

  const eligibilityLink = <InlineLink to={t(($) => $.submit.doYouQualifyHref)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.submit.pageHeading)}</AppPageTitle>
      <ErrorSummaryProvider actionData={fetcher.data}>
        <ProgressStepper activeStep="submit" className="mb-8" />
        <div className="max-w-prose space-y-8">
          <ErrorSummary />
          <div className="space-y-8">
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.overview)}</h2>
              <div className="space-y-4">
                <p>{t(($) => $.submit.youAreSubmitting)}</p>
                <ul className="list-disc space-y-1 pl-7">
                  {state.children.map((child) => (
                    <li key={child.id}>{child.name}</li>
                  ))}
                </ul>
              </div>
            </section>
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.reviewYourApplication)}</h2>
              <p>{t(($) => $.submit.pleaseReview)}</p>
              <ButtonLink variant="primary" routeId="public/application/$id/your-application" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Child:Action click">
                {t(($) => $.submit.reviewApplication)}
              </ButtonLink>
            </section>
            <section className="space-y-4">
              <h2 className="font-lato text-3xl leading-none font-bold">{t(($) => $.submit.submitYourApplication)}</h2>
              <p>{t(($) => $.submit.bySubmitting)}</p>
              <p>
                <Trans ns="applicationSimplifiedChild" i18nKey={($) => $.submit.reviewEligibilityCriteria} components={{ eligibilityLink }} />
              </p>
              <fetcher.Form method="post" onSubmit={handleSubmit} noValidate>
                <CsrfTokenInput />
                {hCaptchaEnabled && <HCaptcha size="invisible" sitekey={sitekey} ref={captchaRef} onLoad={onLoad} />}
                <div className="space-y-2">
                  <InputCheckbox id="acknowledge-info" name="acknowledgeInfo" value={CHECKBOX_VALUE.yes} errorMessage={errors?.acknowledgeInfo} required>
                    {t(($) => $.submit.infoIsCorrect)}
                  </InputCheckbox>
                  <InputCheckbox id="acknowledge-criteria" name="acknowledgeCriteria" value={CHECKBOX_VALUE.yes} errorMessage={errors?.acknowledgeCriteria} required>
                    {t(($) => $.submit.iUnderstand)}
                  </InputCheckbox>
                </div>
                <div className="mt-8 grid gap-3 sm:grid-cols-[1fr_170px]">
                  <LoadingButton loading={isSubmitting} variant="green" className="order-first h-full text-base sm:order-last sm:text-lg" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Child:Submit click">
                    {t(($) => $.submit.submit)}
                  </LoadingButton>
                  <NavigationButtonLink
                    disabled={isSubmitting}
                    variant="secondary"
                    direction="previous"
                    routeId="public/application/$id/simplified-children/childrens-application"
                    params={params}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Simplified_Child:Back click"
                  >
                    {t(($) => $.submit.childrensApplication)}
                  </NavigationButtonLink>
                </div>
              </fetcher.Form>
            </section>
          </div>
          <div className="mt-8">
            <InlineLink routeId="public/application/$id/simplified-children/exit-application" params={params}>
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
