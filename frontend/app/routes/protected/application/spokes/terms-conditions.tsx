import { useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/terms-conditions';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getProtectedApplicationState, saveProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { transformFlattenedError } from '~/.server/utils/zod.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Collapsible } from '~/components/collapsible';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InlineLink } from '~/components/inline-link';
import { InputCheckbox } from '~/components/input-checkbox';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

const CHECKBOX_VALUE = {
  yes: 'yes',
} as const;

const CHECKBOX_IDS = {
  ACKNOWLEDGE_TERMS: 'acknowledgeTerms',
  ACKNOWLEDGE_PRIVACY: 'acknowledgePrivacy',
  SHARE_DATA: 'shareData',
  DO_NOT_CONSENT: 'doNotConsent',
} as const;

type CheckboxId = (typeof CHECKBOX_IDS)[keyof typeof CHECKBOX_IDS];

const CONSENT_CHECKBOXES = [CHECKBOX_IDS.ACKNOWLEDGE_TERMS, CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY, CHECKBOX_IDS.SHARE_DATA] as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.termsConditions,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request, params }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = getProtectedApplicationState({ params, session });
  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.termsConditions.pageTitle) }),
  };
  return { defaultState: state.termsAndConditions, meta };
}

export async function action({ context, request, params }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  getProtectedApplicationState({ params, session });

  const formData = await request.formData();
  const t = await getFixedT(request, 'protectedApplicationSpokes');

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });
  securityHandler.validateCsrfToken({ formData, session });

  const consentSchema = z
    .object({
      acknowledgeTerms: z.string().trim().optional(),
      acknowledgePrivacy: z.string().trim().optional(),
      shareData: z.string().trim().optional(),
      doNotConsent: z.string().trim().optional(),
    })

    .superRefine((val, ctx) => {
      if (val.doNotConsent) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.termsConditions.checkboxes.errorMessage.consentRequired),
          path: ['doNotConsent'],
        });
      }
      if (!val.doNotConsent && !val.acknowledgeTerms) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.termsConditions.checkboxes.errorMessage.acknowledgeTermsRequired),
          path: ['acknowledgeTerms'],
        });
      }
      if (!val.doNotConsent && !val.acknowledgePrivacy) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.termsConditions.checkboxes.errorMessage.acknowledgePrivacyRequired),
          path: ['acknowledgePrivacy'],
        });
      }
      if (!val.doNotConsent && !val.shareData) {
        ctx.addIssue({
          code: 'custom',
          message: t(($) => $.termsConditions.checkboxes.errorMessage.shareDataRequired),
          path: ['shareData'],
        });
      }
    })
    .transform((val) => ({
      acknowledgeTerms: val.acknowledgeTerms === CHECKBOX_VALUE.yes,
      acknowledgePrivacy: val.acknowledgePrivacy === CHECKBOX_VALUE.yes,
      shareData: val.shareData === CHECKBOX_VALUE.yes,
      doNotConsent: val.doNotConsent === CHECKBOX_VALUE.yes,
    }));

  const parsedDataResult = consentSchema.safeParse({
    acknowledgeTerms: formData.get('acknowledgeTerms') ?? '',
    acknowledgePrivacy: formData.get('acknowledgePrivacy') ?? '',
    shareData: formData.get('shareData') ?? '',
    doNotConsent: formData.get('doNotConsent') ?? '',
  });

  if (!parsedDataResult.success) {
    return data({ errors: transformFlattenedError(z.flattenError(parsedDataResult.error)) }, { status: 400 });
  }

  saveProtectedApplicationState({ params, session, state: { termsAndConditions: parsedDataResult.data } });
  return redirect(getPathById('protected/application/$id/eligibility-requirements', params));
}

export default function ApplyIndex({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplicationSpokes');
  const { defaultState } = loaderData;

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const errors = fetcher.data?.errors;

  const [checkboxState, setCheckboxState] = useState({
    [CHECKBOX_IDS.ACKNOWLEDGE_TERMS]: defaultState?.acknowledgeTerms ?? false,
    [CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY]: defaultState?.acknowledgePrivacy ?? false,
    [CHECKBOX_IDS.SHARE_DATA]: defaultState?.shareData ?? false,
    [CHECKBOX_IDS.DO_NOT_CONSENT]: false,
  });

  const handleCheckboxChange = (checkboxId: CheckboxId, checked: boolean) => {
    if (checkboxId === CHECKBOX_IDS.DO_NOT_CONSENT) {
      if (checked) {
        setCheckboxState({
          [CHECKBOX_IDS.ACKNOWLEDGE_TERMS]: false,
          [CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY]: false,
          [CHECKBOX_IDS.SHARE_DATA]: false,
          [CHECKBOX_IDS.DO_NOT_CONSENT]: true,
        });
      } else {
        setCheckboxState((prev) => ({
          ...prev,
          [CHECKBOX_IDS.DO_NOT_CONSENT]: false,
        }));
      }
    } else if (CONSENT_CHECKBOXES.includes(checkboxId as (typeof CONSENT_CHECKBOXES)[number])) {
      if (checked) {
        setCheckboxState((prev) => ({
          ...prev,
          [checkboxId]: checked,
          [CHECKBOX_IDS.DO_NOT_CONSENT]: false,
        }));
      } else {
        setCheckboxState((prev) => ({
          ...prev,
          [checkboxId]: checked,
        }));
      }
    }
  };

  const esdcPib = <InlineLink to={t(($) => $.termsConditions.links.esdcPib)} className="external-link" newTabIndicator target="_blank" />;
  const hcPib = <InlineLink to={t(($) => $.termsConditions.links.hcPib)} className="external-link" newTabIndicator target="_blank" />;

  const canadaTermsConditions = <InlineLink to={t(($) => $.termsConditions.links.canadaCaTermsAndConditions)} className="external-link" newTabIndicator target="_blank" />;
  const contactServiceCanada = <InlineLink to={t(($) => $.termsConditions.links.serviceCanada)} className="external-link" newTabIndicator target="_blank" />;
  const eligibilityRequirements = <InlineLink to={t(($) => $.termsConditions.links.eligibilityRequirements)} className="external-link" newTabIndicator target="_blank" />;
  const fileacomplaint = <InlineLink to={t(($) => $.termsConditions.links.fileComplaint)} className="external-link" newTabIndicator target="_blank" />;
  const hcaptchaTermsOfService = <InlineLink to={t(($) => $.termsConditions.links.hcaptcha)} className="external-link" newTabIndicator target="_blank" />;
  const infosource = <InlineLink to={t(($) => $.termsConditions.links.infoSource)} className="external-link" newTabIndicator target="_blank" />;
  const microsoftDataPrivacyPolicy = <InlineLink to={t(($) => $.termsConditions.links.microsoftDataPrivacyPolicy)} className="external-link" newTabIndicator target="_blank" />;
  const cdcpPrivacyPolicy = <InlineLink to={t(($) => $.termsConditions.links.cdcpPrivacyPolicy)} className="external-link" newTabIndicator target="_blank" />;
  const cite = <cite />;

  return (
    <>
      <AppPageTitle>{t(($) => $.termsConditions.pageHeading)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="space-y-6">
          <h2 className="font-bold">{t(($) => $.termsConditions.beforeYouBegin)}</h2>
          <ul className="list-disc space-y-1 pl-7">
            <li>
              <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.reviewConfirm} components={{ eligibilityRequirements }} />
            </li>
            <li>{t(($) => $.termsConditions.resolveActions)}</li>
            <li>{t(($) => $.termsConditions.reviewStatements)}</li>
          </ul>
          <Collapsible summary={t(($) => $.termsConditions.termsAndConditionsOfUse.summary)}>
            <div className="space-y-6">
              <div className="space-y-4">
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.termsAndConditionsOfUse.onlineApplicationLegalTerms} components={{ canadaTermsConditions }} />
                </p>
                <p>{t(($) => $.termsConditions.termsAndConditionsOfUse.esdcDefinitionClarification)}</p>
              </div>
              <section className="space-y-4">
                <h2 className="font-lato text-lg font-bold">{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.heading)}</h2>
                <ul className="list-disc space-y-1 pl-7">
                  <li>{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.selfAgreement)}</li>
                  <li>{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.timeout)}</li>
                  <li>{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.incorrectInformation)}</li>
                  <li>{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.onBehalfOfSomeoneElse)}</li>
                  <li>{t(($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.atYourOwnRisk)}</li>
                  <li>
                    <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.msdc} components={{ microsoftDataPrivacyPolicy }} />
                  </li>
                  <li>
                    <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.termsAndConditionsOfUse.onlineApplication.antibot} components={{ hcaptchaTermsOfService }} />
                  </li>
                </ul>
              </section>
              <section className="space-y-4">
                <p>{t(($) => $.termsConditions.termsAndConditionsOfUse.changesToTheseTermsOfUse.esdcTermsAmendmentPolicy)}</p>
              </section>
            </div>
          </Collapsible>

          <Collapsible summary={t(($) => $.termsConditions.privacyNoticeStatement.summary)}>
            <div className="space-y-6">
              <section className="space-y-4">
                <h2 className="font-lato text-lg font-bold">{t(($) => $.termsConditions.privacyNoticeStatement.personalInformation.heading)}</h2>
                <p>{t(($) => $.termsConditions.privacyNoticeStatement.personalInformation.serviceCanadaApplicationAdministration)}</p>
                <p>{t(($) => $.termsConditions.privacyNoticeStatement.personalInformation.serviceCanadaInformationCollection)}</p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.personalInformation.participation} components={{ contactServiceCanada }} />
                </p>
                <p>{t(($) => $.termsConditions.privacyNoticeStatement.personalInformation.policyAnalysis)}</p>
                <p>{t(($) => $.termsConditions.privacyNoticeStatement.personalInformation.digitalCommunications)}</p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.personalInformation.collectionUse} components={{ cite }} />
                </p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.personalInformation.microsoftPolicy} components={{ microsoftDataPrivacyPolicy, cite }} />
                </p>
              </section>
              <section className="space-y-4">
                <h2 className="font-lato text-lg font-bold">{t(($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.heading)}</h2>
                <p>{t(($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.personalInformationRightsAndAccess)}</p>
                <ul className="list-disc space-y-1 pl-7">
                  <li>
                    <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.personalInformationBanks.hcPpu440} components={{ hcPib }} />
                  </li>
                  <li>
                    <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.personalInformationBanks.esdcPpu712} components={{ esdcPib }} />
                  </li>
                </ul>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.infoSourceAccess} components={{ infosource }} />
                </p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.privacyContact} components={{ contactServiceCanada }} />
                </p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.personalInformationHandlingComplaintProcess} components={{ fileacomplaint }} />
                </p>
                <p>
                  <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.privacyNoticeStatement.howWeProtectYourPrivacy.privacyProtection} components={{ cdcpPrivacyPolicy }} />
                </p>
              </section>
            </div>
          </Collapsible>
          <Collapsible summary={t(($) => $.termsConditions.sharingYourInformation.summary)}>
            <div className="space-y-6">
              <section className="space-y-4">
                <h2 className="font-lato text-lg font-bold">{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.heading)}</h2>
                <p>{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.shareInfo)}</p>
                <p>{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.policyAnalysis)}</p>
                <p>{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.sendLetters)}</p>
                <p>{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.discloseInfo)}</p>
                <p>{t(($) => $.termsConditions.sharingYourInformation.governmentOfCanadaAndSunLife.sunLifeAuthorization)}</p>
              </section>
              <section className="space-y-4">
                <h2 className="font-lato text-lg font-bold">{t(($) => $.termsConditions.sharingYourInformation.sharingOfInformationAndOralHealthProviders.heading)}</h2>
                <p>{t(($) => $.termsConditions.sharingYourInformation.sharingOfInformationAndOralHealthProviders.enrolConsent)}</p>
                <p>{t(($) => $.termsConditions.sharingYourInformation.sharingOfInformationAndOralHealthProviders.consideredMinor)}</p>
              </section>
            </div>
          </Collapsible>
        </div>
        <p className="my-8" id="application-consent">
          {t(($) => $.termsConditions.apply.applicationConsent)}
        </p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <ErrorSummary />
            <div className="space-y-2">
              <InputCheckbox
                id="acknowledge-terms"
                name={CHECKBOX_IDS.ACKNOWLEDGE_TERMS}
                value={CHECKBOX_VALUE.yes}
                checked={checkboxState[CHECKBOX_IDS.ACKNOWLEDGE_TERMS]}
                onChange={(e) => handleCheckboxChange(CHECKBOX_IDS.ACKNOWLEDGE_TERMS, e.target.checked)}
                errorMessage={errors?.acknowledgeTerms}
                required
              >
                {t(($) => $.termsConditions.checkboxes.acknowledgeTerms)}
              </InputCheckbox>

              <InputCheckbox
                id="acknowledge-privacy"
                name={CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY}
                value={CHECKBOX_VALUE.yes}
                checked={checkboxState[CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY]}
                onChange={(e) => handleCheckboxChange(CHECKBOX_IDS.ACKNOWLEDGE_PRIVACY, e.target.checked)}
                errorMessage={errors?.acknowledgePrivacy}
                required
              >
                {t(($) => $.termsConditions.checkboxes.acknowledgePrivacy)}
              </InputCheckbox>

              <InputCheckbox
                id="share-data"
                name={CHECKBOX_IDS.SHARE_DATA}
                value={CHECKBOX_VALUE.yes}
                checked={checkboxState[CHECKBOX_IDS.SHARE_DATA]}
                onChange={(e) => handleCheckboxChange(CHECKBOX_IDS.SHARE_DATA, e.target.checked)}
                errorMessage={errors?.shareData}
                required
              >
                {t(($) => $.termsConditions.checkboxes.shareData)}
              </InputCheckbox>
            </div>

            <InputCheckbox
              id="do-not-consent"
              name={CHECKBOX_IDS.DO_NOT_CONSENT}
              value={CHECKBOX_VALUE.yes}
              className="my-8"
              checked={checkboxState[CHECKBOX_IDS.DO_NOT_CONSENT]}
              onChange={(e) => handleCheckboxChange(CHECKBOX_IDS.DO_NOT_CONSENT, e.target.checked)}
              errorMessage={errors?.doNotConsent}
            >
              <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.termsConditions.checkboxes.doNotConsent} />
            </InputCheckbox>

            <div className="mt-8 flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <LoadingButton aria-describedby="application-consent" variant="primary" id="continue-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Continue - Terms and Conditions click">
                {t(($) => $.termsConditions.apply.continueButton)}
              </LoadingButton>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId="protected/application/$id/eligibility-requirements"
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Terms and Conditions click"
              >
                {t(($) => $.termsConditions.apply.backButton)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
