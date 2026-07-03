import { redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/confirmation';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getEligibilityStatus } from '~/.server/routes/helpers/base-application-route-helpers';
import { clearPublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { loadPublicApplicationSimplifiedAdultState } from '~/.server/routes/helpers/public-application-simplified-adult-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { Address } from '~/components/address';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/dialog';
import { Eligibility } from '~/components/eligibility';
import { InlineLink } from '~/components/inline-link';
import { PrintButton } from '~/components/print-button';
import { useApplicationFlowStorage } from '~/hooks';
import { pageIds } from '~/page-ids';
import { formatClientNumber, formatSubmissionApplicationCode } from '~/utils/application-code-utils';
import { parseDateString, toLocaleDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

export const handle = {
  pageIdentifier: pageIds.public.application.simplifiedAdult.confirmation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedAdultState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-adult']);

  const t = await getFixedT(url, ['applicationSimplifiedAdult', 'gcweb']);
  const locale = getLocale(url);

  if (
    !state.applicantInformation ||
    !state.communicationPreferences ||
    !state.dentalBenefits ||
    !state.dentalInsurance ||
    !state.phoneNumber ||
    !state.mailingAddress ||
    !state.homeAddress ||
    !state.submitTerms ||
    !state.hasFiledTaxes ||
    !state.submissionInfo
  ) {
    throw new Error(`Incomplete application "${state.id}" state!`);
  }

  const env = appContainer.get(TYPES.ClientConfig);
  const surveyLink = locale === 'en' ? env.CDCP_SURVEY_LINK_EN : env.CDCP_SURVEY_LINK_FR;

  const publicApplicationStateResolver = appContainer.get(TYPES.PublicApplicationStateResolver);

  const phoneNumber = publicApplicationStateResolver.resolvePhoneNumberValue({ clientApplication: state.clientApplication, phoneNumber: state.phoneNumber });
  const mailingAddress = await publicApplicationStateResolver.resolveMailingAddressValue({ clientApplication: state.clientApplication, mailingAddress: state.mailingAddress }, locale);
  const homeAddress = await publicApplicationStateResolver.resolveHomeAddressValue({ clientApplication: state.clientApplication, homeAddress: state.homeAddress }, locale);
  const communicationPreferences = publicApplicationStateResolver.resolveCommunicationPreferencesValue({ clientApplication: state.clientApplication, communicationPreferences: state.communicationPreferences }, locale);
  const dentalBenefits = await publicApplicationStateResolver.resolveDentalBenefitsValue({ dentalBenefits: state.dentalBenefits, clientApplication: state.clientApplication }, locale);

  const userInfo = {
    firstName: state.applicantInformation.firstName,
    lastName: state.applicantInformation.lastName,
    communicationPreferences: communicationPreferences,
    dateOfBirth: toLocaleDateString(parseDateString(state.applicantInformation.dateOfBirth), locale),
    email: publicApplicationStateResolver.resolveEmailValue(state),
    memberId: state.applicantInformation.memberId,
    phoneNumber: phoneNumber,
    socialInsuranceNumber: state.applicantInformation.socialInsuranceNumber,
  };

  const spouseInfo = state.partnerInformation;

  const dentalInsurance = {
    hasDentalInsurance: state.dentalInsurance.hasDentalInsurance,
  };

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.confirm.pageTitle) }),
  };

  const eligibility = getEligibilityStatus({
    hasPrivateDentalInsurance: state.dentalInsurance.hasDentalInsurance,
    privateDentalInsuranceOnRecord: state.clientApplication.privateDentalInsurance,
  });

  return {
    dentalBenefits,
    dentalInsurance,
    homeAddress,
    mailingAddress,
    meta,
    spouseInfo,
    submissionInfo: state.submissionInfo,
    surveyLink,
    userInfo,
    eligibility,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = loadPublicApplicationSimplifiedAdultState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['simplified-adult']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'applicationSimplifiedAdult');

  clearPublicApplicationState({ params, session });

  return redirect(t(($) => $.confirm.exitLink));
}

export default function RenewAdultConfirm({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('applicationSimplifiedAdult');
  const fetcher = useFetcher<typeof action>();
  const { userInfo, spouseInfo, homeAddress, mailingAddress, dentalInsurance, dentalBenefits, submissionInfo, surveyLink, eligibility } = loaderData;
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const mscaLinkAccount = <InlineLink to={t(($) => $.confirm.mscaLinkAccount)} className="external-link" newTabIndicator target="_blank" />;
  const cdcpLink = <InlineLink to={t(($) => $.confirm.mscaLinkChecker)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.confirm.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        <section className="space-y-6">
          <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.yourEligibility)}</h3>
          <DefinitionList border>
            <DefinitionListItem term={`${userInfo.firstName} ${userInfo.lastName}`}>
              <Eligibility type={eligibility} />
            </DefinitionListItem>
          </DefinitionList>
        </section>
        <div className="space-y-4">
          <h2 className="text-3xl">
            <strong>{t(($) => $.confirm.appCodeIs)}</strong>
            <br />
            <strong>{formatSubmissionApplicationCode(submissionInfo.confirmationCode)}</strong>
          </h2>
          <p>{t(($) => $.confirm.makeNote)}</p>
        </div>
        <section>
          <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.keepCopy)}</h2>
          <p className="mt-4">{t(($) => $.confirm.printCopyImportant)}</p>
          <div className="mt-8 print:hidden">
            <PrintButton variant="primary" size="lg" errorMessage={t(($) => $.confirm.printUnavailable)} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Print top - Application successfully submitted click">
              {t(($) => $.confirm.printBtn)}
            </PrintButton>
          </div>
        </section>
        <ContextualAlert type="comment">
          <div className="space-y-4">
            <h2 className="text-2xl">
              <strong>{t(($) => $.confirm.survey.title)}</strong>
            </h2>
            <p>{t(($) => $.confirm.survey.info)}</p>
            <ButtonLink
              id="survey-button"
              to={surveyLink}
              className="external-link"
              newTabIndicator
              target="_blank"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Confirmation survey button - Take the survey click"
              variant="primary"
            >
              {t(($) => $.confirm.survey.button)}
            </ButtonLink>
          </div>
        </ContextualAlert>
        <section>
          <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.whatsNext)}</h2>
          <p className="mt-4">
            <Trans ns="applicationSimplifiedAdult" i18nKey={($) => $.confirm.beginProcess} components={{ cdcpLink, mscaLinkAccount }} />
          </p>
        </section>
        <section>
          <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.getUpdatesTitle)}</h2>
          <p className="my-4">
            <Trans ns="applicationSimplifiedAdult" i18nKey={($) => $.confirm.getUpdatesText} components={{ mscaLinkAccount }} />
          </p>
          <ul className="list-disc space-y-1 pl-7">
            <li>{t(($) => $.confirm.view)}</li>
            <li>{t(($) => $.confirm.update)}</li>
            <li>{t(($) => $.confirm.access)}</li>
          </ul>
        </section>
        <section className="space-y-8">
          <div className="space-y-6">
            <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.applicationSumm)}</h2>
            <DefinitionList border className="text-xl">
              <DefinitionListItem term={t(($) => $.confirm.applicationCode)}>
                <strong>{formatSubmissionApplicationCode(submissionInfo.confirmationCode)}</strong>
              </DefinitionListItem>
            </DefinitionList>
          </div>

          <section className="space-y-6">
            <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.applicant)}</h2>

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.applicantInfo)}</h3>
              <DefinitionList border>
                {userInfo.memberId && <DefinitionListItem term={t(($) => $.confirm.memberId)}>{formatClientNumber(userInfo.memberId)}</DefinitionListItem>}
                <DefinitionListItem term={t(($) => $.confirm.fullName)}>{`${userInfo.firstName} ${userInfo.lastName}`}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.dob)}>{userInfo.dateOfBirth}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.sin)}>
                  <span className="text-nowrap">{formatSin(userInfo.socialInsuranceNumber)}</span>
                </DefinitionListItem>
              </DefinitionList>
            </section>

            {spouseInfo && (
              <section className="space-y-6">
                <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.spouseInfo)}</h3>
                <DefinitionList border>
                  <DefinitionListItem term={t(($) => $.confirm.yearBirth)}>{spouseInfo.yearOfBirth}</DefinitionListItem>
                  <DefinitionListItem term={t(($) => $.confirm.sin)}>
                    <span className="text-nowrap">{formatSin(spouseInfo.socialInsuranceNumber)}</span>
                  </DefinitionListItem>
                  <DefinitionListItem term={t(($) => $.confirm.consent)}>{t(($) => $.confirm.consentAnswer)}</DefinitionListItem>
                </DefinitionList>
              </section>
            )}

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.contactInfo)}</h3>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.confirm.phoneNumber)}>
                  <span className="text-nowrap">{userInfo.phoneNumber.hasChanged ? userInfo.phoneNumber.primary : t(($) => $.confirm.noUpdate)}</span>
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.altPhoneNumber)}>
                  <span className="text-nowrap">{userInfo.phoneNumber.hasChanged ? userInfo.phoneNumber.alternate : t(($) => $.confirm.noUpdate)}</span>
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.mailing)}>
                  {mailingAddress.hasChanged ? (
                    <Address
                      address={{
                        address: mailingAddress.address,
                        city: mailingAddress.city,
                        provinceState: mailingAddress.province?.abbr,
                        postalZipCode: mailingAddress.postalCode,
                        country: mailingAddress.country.name,
                      }}
                    />
                  ) : (
                    <span className="text-nowrap">{t(($) => $.confirm.noUpdate)}</span>
                  )}
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.home)}>
                  {homeAddress.hasChanged ? (
                    <Address
                      address={{
                        address: homeAddress.address,
                        city: homeAddress.city,
                        provinceState: homeAddress.province?.abbr,
                        postalZipCode: homeAddress.postalCode,
                        country: homeAddress.country.name,
                      }}
                    />
                  ) : (
                    <span className="text-nowrap">{t(($) => $.confirm.noUpdate)}</span>
                  )}
                </DefinitionListItem>
              </DefinitionList>
            </section>

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.commPref)}</h3>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.confirm.langPref)}>{userInfo.communicationPreferences.hasChanged ? userInfo.communicationPreferences.preferredLanguage.name : t(($) => $.confirm.noUpdate)}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.sunLifeCommPrefTitle)}>{userInfo.communicationPreferences.hasChanged ? userInfo.communicationPreferences.preferredMethodSunLife.name : t(($) => $.confirm.noUpdate)}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.gocCommPrefTitle)}>{userInfo.communicationPreferences.hasChanged ? userInfo.communicationPreferences.preferredMethodGovernmentOfCanada.name : t(($) => $.confirm.noUpdate)}</DefinitionListItem>
                {userInfo.email && <DefinitionListItem term={t(($) => $.confirm.email)}>{userInfo.communicationPreferences.hasChanged ? userInfo.email : t(($) => $.confirm.noUpdate)}</DefinitionListItem>}
              </DefinitionList>
            </section>

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.dentalInsurance)}</h3>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.confirm.dentalPrivate)}>{dentalInsurance.hasDentalInsurance ? t(($) => $.confirm.yes) : t(($) => $.confirm.no)}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.dentalPublic)}>
                  {dentalBenefits.hasChanged && (dentalBenefits.federalGovernmentInsurancePlan || dentalBenefits.provincialGovernmentInsurancePlan) ? (
                    <div className="space-y-3">
                      <p>{t(($) => $.confirm.yes)}</p>
                      <p>{t(($) => $.confirm.dentalBenefitHasAccess)}</p>
                      <ul className="list-disc space-y-1 pl-7">
                        {dentalBenefits.federalGovernmentInsurancePlan && <li>{dentalBenefits.federalGovernmentInsurancePlan.name}</li>}
                        {dentalBenefits.provincialGovernmentInsurancePlan && <li>{dentalBenefits.provincialGovernmentInsurancePlan.name}</li>}
                      </ul>
                    </div>
                  ) : (
                    <>{dentalBenefits.hasChanged ? t(($) => $.confirm.no) : t(($) => $.confirm.noUpdate)}</>
                  )}
                </DefinitionListItem>
              </DefinitionList>
            </section>
          </section>
        </section>
        <div className="my-6 print:hidden">
          <PrintButton size="lg" variant="primary" errorMessage={t(($) => $.confirm.printUnavailable)} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Print bottom - Application successfully submitted click">
            {t(($) => $.confirm.printBtn)}
          </PrintButton>
        </div>
        <Dialog>
          <DialogTrigger className="print:hidden" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Exit - Application successfully submitted click" asChild>
            <Button variant="secondary">{t(($) => $.confirm.closeApplication)}</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{t(($) => $.confirm.modal.header)}</DialogTitle>
            </DialogHeader>
            <p>{t(($) => $.confirm.modal.info)}</p>
            <p>{t(($) => $.confirm.modal.areYouSure)}</p>
            <DialogFooter>
              <DialogClose asChild>
                <Button id="confirm-modal-back" variant="secondary" size="sm" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Back exit modal - Application successfully submitted click">
                  {t(($) => $.confirm.modal.backBtn)}
                </Button>
              </DialogClose>
              <fetcher.Form method="post" noValidate>
                <CsrfTokenInput />
                <Button
                  id="confirm-modal-close"
                  variant="primary"
                  size="sm"
                  onClick={() => removeApplicationFlowStorageValue()}
                  data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Renewal Form-Adult:Confirmation exit modal - Application successfully submitted click"
                >
                  {t(($) => $.confirm.modal.closeBtn)}
                </Button>
              </fetcher.Form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
