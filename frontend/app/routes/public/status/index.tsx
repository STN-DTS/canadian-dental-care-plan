import { redirect, useFetcher } from 'react-router';

import { faChevronRight } from '@fortawesome/free-solid-svg-icons';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState, useHCaptcha } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useFeature } from '~/root';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const CHECK_FOR = {
  myself: 'Myself',
  child: 'Child',
} as const;

export const handle = {
  pageIdentifier: pageIds.public.status.index,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  const t = await getFixedT(url, ['status', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.pageTitle) }),
  };
  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('status');
  securityHandler.validateCsrfToken({ formData, session });
  await securityHandler.validateHCaptchaResponse({ formData, request }, () => {
    throw redirect(getPathById('public/unable-to-process-request', params));
  });

  const t = await getFixedT(url, 'status');
  const formDataSchema = z.object({
    checkFor: z.enum(CHECK_FOR, {
      error: t(($) => $.form.errorMessage.selectionRequired),
    }),
  });

  const parsedCheckFor = formDataSchema.safeParse({
    checkFor: formData.get('statusCheckFor'),
  });

  if (!parsedCheckFor.success) {
    return {
      errors: transformFlattenedError(z.flattenError(parsedCheckFor.error)),
    };
  }

  if (parsedCheckFor.data.checkFor === CHECK_FOR.myself) {
    return redirect(getPathById('public/status/myself', { ...params }));
  }
  // Child selected
  return redirect(getPathById('public/status/child', { ...params }));
}

export default function StatusChecker({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('status');
  const hCaptchaEnabled = useFeature('hcaptcha');
  const { captchaRef, onLoad, sitekey } = useHCaptcha();
  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const errors = fetcher.data?.errors;

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

  const hcaptchaTermsOfService = <InlineLink to={t(($) => $.links.hcaptcha)} className="external-link" newTabIndicator target="_blank" />;
  const microsoftDataPrivacyPolicy = <InlineLink to={t(($) => $.links.microsoftDataPrivacyPolicy)} className="external-link" newTabIndicator target="_blank" />;
  const microsoftServiceAgreement = <InlineLink to={t(($) => $.links.microsoftServiceAgreement)} className="external-link" newTabIndicator target="_blank" />;
  const fileacomplaint = <InlineLink to={t(($) => $.links.fileComplaint)} className="external-link" newTabIndicator target="_blank" />;
  const canadaTermsConditions = <InlineLink to={t(($) => $.links.canadaTermsConditions)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div>
          <h2 className="font-bold">{t(($) => $.statusCheckerHeading)}</h2>
          <p className="mb-4">{t(($) => $.statusCheckerContent)}</p>
          <h2 className="font-bold">{t(($) => $.onlineStatusHeading)}</h2>
          <p className="mb-4">{t(($) => $.onlineStatusContent)}</p>
          <p className="mb-4">{t(($) => $.termsConditions)}</p>
        </div>
        <Collapsible summary={t(($) => $.termsOfUse.summary)} className="mt-8">
          <div className="space-y-4">
            <h2 className="mb-4 font-bold">{t(($) => $.termsOfUse.heading)}</h2>
            <p>{t(($) => $.termsOfUse.thankYou)}</p>
            <p>
              <Trans ns="status" i18nKey={($) => $.termsOfUse.legalTerms} components={{ canadaTermsConditions }} />
            </p>
            <p>{t(($) => $.termsOfUse.accessTerms)}</p>
            <p>{t(($) => $.termsOfUse.maintenance)}</p>
            <p>{t(($) => $.termsOfUse.inactive)}</p>
            <p>{t(($) => $.termsOfUse.termsRejectionPolicy)}</p>

            <p>{t(($) => $.termsOfUse.esdcDefinitionClarification)}</p>
            <p className="font-bold">{t(($) => $.termsOfUse.statusChecker.heading)}</p>
            <ul className="list-disc space-y-1 pl-7">
              <li>{t(($) => $.termsOfUse.statusChecker.selfAgreement)}</li>
              <li>{t(($) => $.termsOfUse.statusChecker.onBehalfOfSomeoneElse)}</li>
              <li>{t(($) => $.termsOfUse.statusChecker.atYourOwnRisk)}</li>
              <li>{t(($) => $.termsOfUse.statusChecker.onlyUse)}</li>
              <li>
                <Trans ns="status" i18nKey={($) => $.termsOfUse.statusChecker.msdc} components={{ microsoftServiceAgreement }} />
              </li>
              <li>
                <Trans ns="status" i18nKey={($) => $.termsOfUse.statusChecker.antibot} components={{ hcaptchaTermsOfService }} />
              </li>
            </ul>
            <h2 className="font-bold">{t(($) => $.termsOfUse.changesToTheseTermsOfUse.heading)}</h2>
            <p>{t(($) => $.termsOfUse.changesToTheseTermsOfUse.esdcTermsAmendmentPolicy)}</p>
          </div>
        </Collapsible>
        <Collapsible summary={t(($) => $.privacyNoticeStatement.summary)} className="my-8">
          <div className="space-y-4">
            <p>
              <Trans ns="status" i18nKey={($) => $.privacyNoticeStatement.collectionOfUse} components={{ cite: <cite /> }} />
            </p>
            <p>{t(($) => $.privacyNoticeStatement.providedInformation)}</p>
            <p>
              <Trans ns="status" i18nKey={($) => $.privacyNoticeStatement.thirdPartyProvider} components={{ microsoftDataPrivacyPolicy }} />
            </p>
            <p>
              <Trans ns="status" i18nKey={($) => $.privacyNoticeStatement.personalInformation} components={{ cite: <cite /> }} />
            </p>
            <p>
              <Trans ns="status" i18nKey={($) => $.privacyNoticeStatement.reportAConcern} components={{ fileacomplaint }} />
            </p>
          </div>
        </Collapsible>
        <p className="mb-4 italic">{t(($) => $.form.completeFields)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" onSubmit={handleSubmit} noValidate autoComplete="off" data-gc-analytics-formname="ESDC-EDSC: Canadian Dental Care Plan Status Checker">
            <CsrfTokenInput />
            {hCaptchaEnabled && <HCaptcha size="invisible" sitekey={sitekey} ref={captchaRef} onLoad={onLoad} />}
            <InputRadios
              id="status-check-for"
              name="statusCheckFor"
              legend={t(($) => $.form.radioLegend)}
              options={[
                {
                  children: <Trans ns="status" i18nKey={($) => $.form.radioText.myself} />,
                  value: CHECK_FOR.myself,
                },
                {
                  children: <Trans ns="status" i18nKey={($) => $.form.radioText.child} />,
                  value: CHECK_FOR.child,
                },
              ]}
              required
              errorMessage={errors?.checkFor}
            />
            <LoadingButton variant="primary" id="submit" loading={isSubmitting} className="my-8" data-gc-analytics-formsubmit="submit" endIcon={faChevronRight}>
              {t(($) => $.form.continue)}
            </LoadingButton>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
