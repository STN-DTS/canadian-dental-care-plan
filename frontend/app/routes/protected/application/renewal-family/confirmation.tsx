import { redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/confirmation';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getEligibilityStatus } from '~/.server/routes/helpers/base-application-route-helpers';
import { loadProtectedApplicationRenewalFamilyState } from '~/.server/routes/helpers/protected-application-renewal-family-route-helpers';
import { clearProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
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
  pageIdentifier: pageIds.protected.application.renewalFamily.confirmation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalFamilyState({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-family']);

  const t = await getFixedT(request, ['protectedApplicationRenewalFamily', 'gcweb']);
  const locale = getLocale(request);

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
    !state.submissionInfo ||
    state.children.some((child) => !child.information || !child.dentalInsurance || !child.dentalBenefits)
  ) {
    throw new Error(`Incomplete application "${state.id}" state!`);
  }

  const env = appContainer.get(TYPES.ClientConfig);
  const surveyLink = locale === 'en' ? env.CDCP_SURVEY_LINK_EN : env.CDCP_SURVEY_LINK_FR;

  const stateResolver = appContainer.get(TYPES.ProtectedApplicationStateResolver);
  const phoneNumber = stateResolver.resolvePhoneNumberValue({ clientApplication: state.clientApplication, phoneNumber: state.phoneNumber });
  const mailingAddress = await stateResolver.resolveMailingAddressValue({ clientApplication: state.clientApplication, mailingAddress: state.mailingAddress }, locale);
  const homeAddress = await stateResolver.resolveHomeAddressValue({ clientApplication: state.clientApplication, homeAddress: state.homeAddress }, locale);
  const communicationPreferences = stateResolver.resolveCommunicationPreferencesValue({ clientApplication: state.clientApplication, communicationPreferences: state.communicationPreferences }, locale);
  const dentalBenefits = await stateResolver.resolveDentalBenefitsValue({ dentalBenefits: state.dentalBenefits, clientApplication: state.clientApplication }, locale);

  const userInfo = {
    memberId: state.applicantInformation.memberId,
    firstName: state.applicantInformation.firstName,
    lastName: state.applicantInformation.lastName,
    communicationPreferences: communicationPreferences,
    dateOfBirth: toLocaleDateString(parseDateString(state.applicantInformation.dateOfBirth), locale),
    email: stateResolver.resolveEmailValue(state),
    maritalStatus: state.maritalStatus ? appContainer.get(TYPES.MaritalStatusService).getLocalizedMaritalStatusById(state.maritalStatus, locale).name : '',
    phoneNumber: phoneNumber,
    socialInsuranceNumber: state.applicantInformation.socialInsuranceNumber,
  };

  const spouseInfo = state.partnerInformation;

  const dentalInsurance = {
    hasDentalInsurance: state.dentalInsurance.hasDentalInsurance,
  };

  const children = await Promise.all(
    state.children.map(async (childState) => {
      invariant(childState.information, `Expected information for child with id ${childState.id}`);
      invariant(childState.dentalBenefits, `Expected dental benefits for child with id ${childState.id}`);
      invariant(childState.dentalInsurance, `Expected dental insurance for child with id ${childState.id}`);

      const childApplication = state.clientApplication.children.find((childApp) => childApp.information.clientNumber === childState.information?.memberId);
      invariant(childApplication?.dentalBenefits, `Expected dental benefits for child with memberId ${childState.information.memberId}`);

      const childDentalBenefits = await stateResolver.resolveChildDentalBenefitsValue({ dentalBenefits: childState.dentalBenefits }, childApplication, locale);
      const eligibility = getEligibilityStatus({
        hasPrivateDentalInsurance: childState.dentalInsurance.hasDentalInsurance,
        privateDentalInsuranceOnRecord: childApplication.privateDentalInsurance,
      });

      return {
        id: childState.id,
        memberId: childState.information.memberId,
        firstName: childState.information.firstName,
        lastName: childState.information.lastName,
        socialInsuranceNumber: childState.information.socialInsuranceNumber,
        isParent: childState.information.isParent,
        dateOfBirth: toLocaleDateString(parseDateString(childState.information.dateOfBirth), locale),
        dentalBenefits: childDentalBenefits,
        hasDentalInsurance: childState.dentalInsurance.hasDentalInsurance,
        eligibility,
      };
    }),
  );

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
    children,
    eligibility,
    isSimplifiedRenewal: state.clientApplication.inputModel === 'simplified',
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const state = loadProtectedApplicationRenewalFamilyState({ params, request, session });
  validateApplicationFlow(state, params, ['renewal-family']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'protectedApplicationRenewalFamily');

  clearProtectedApplicationState({ params, session });

  return redirect(t(($) => $.confirm.exitLink));
}

export default function ProtectedRenewalFamilyConfirmation({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplicationRenewalFamily');
  const fetcher = useFetcher<typeof action>();
  const { userInfo, spouseInfo, homeAddress, mailingAddress, dentalInsurance, dentalBenefits, submissionInfo, surveyLink, children, eligibility, isSimplifiedRenewal } = loaderData;
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const mscaLinkAccount = <InlineLink to={t(($) => $.confirm.mscaLinkAccount)} className="external-link" newTabIndicator target="_blank" />;
  const cdcpLink = <InlineLink to={t(($) => $.confirm.mscaLinkChecker)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.confirm.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-10">
        {isSimplifiedRenewal && (
          <section className="space-y-6">
            <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.yourEligibility)}</h3>
            <DefinitionList border>
              <DefinitionListItem term={`${userInfo.firstName} ${userInfo.lastName}`}>
                <Eligibility type={eligibility} />
              </DefinitionListItem>
            </DefinitionList>
            {children.map((child) => (
              <DefinitionList key={child.id}>
                <DefinitionListItem term={`${child.firstName} ${child.lastName}`}>
                  <Eligibility type={child.eligibility} />
                </DefinitionListItem>
              </DefinitionList>
            ))}
          </section>
        )}
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
            <PrintButton variant="primary" size="lg" errorMessage={t(($) => $.confirm.printUnavailable)} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Print top - Application successfully submitted click">
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
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Confirmation survey button - Take the survey click"
              variant="primary"
            >
              {t(($) => $.confirm.survey.button)}
            </ButtonLink>
          </div>
        </ContextualAlert>
        {!isSimplifiedRenewal && (
          <>
            <section>
              <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.fullWhatsNext)}</h2>
              <p className="mt-4">{t(($) => $.confirm.fullBeginProcess)}</p>
            </section>

            <section>
              <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.checkStatus)}</h2>
              <p className="mt-4">
                <Trans ns="protectedApplicationRenewalFamily" i18nKey={($) => $.confirm.cdcpChecker} components={{ cdcpLink, noWrap: <span className="whitespace-nowrap" /> }} />
              </p>
              <p className="mt-4">{t(($) => $.confirm.useCode)}</p>
            </section>
          </>
        )}
        {isSimplifiedRenewal && (
          <section>
            <h2 className="font-lato text-3xl font-bold">{t(($) => $.confirm.simplifiedWhatsNext)}</h2>
            <p className="mt-4">
              <Trans ns="protectedApplicationRenewalFamily" i18nKey={($) => $.confirm.simplifiedBeginProcess} components={{ cdcpLink, mscaLinkAccount }} />
            </p>
          </section>
        )}
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
                <DefinitionListItem term={t(($) => $.confirm.maritalStatus)}>{userInfo.maritalStatus}</DefinitionListItem>
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
                  <span className="text-nowrap">{userInfo.phoneNumber.primary}</span>
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.altPhoneNumber)}>
                  <span className="text-nowrap">{userInfo.phoneNumber.alternate}</span>
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.mailing)}>
                  <Address
                    address={{
                      address: mailingAddress.address,
                      city: mailingAddress.city,
                      provinceState: mailingAddress.province?.abbr,
                      postalZipCode: mailingAddress.postalCode,
                      country: mailingAddress.country.name,
                    }}
                  />
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.home)}>
                  <Address
                    address={{
                      address: homeAddress.address,
                      city: homeAddress.city,
                      provinceState: homeAddress.province?.abbr,
                      postalZipCode: homeAddress.postalCode,
                      country: homeAddress.country.name,
                    }}
                  />
                </DefinitionListItem>
              </DefinitionList>
            </section>

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.commPref)}</h3>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.confirm.langPref)}>{userInfo.communicationPreferences.preferredLanguage.name}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.sunLifeCommPrefTitle)}>{userInfo.communicationPreferences.preferredMethodSunLife.name}</DefinitionListItem>
                {userInfo.email && (
                  <DefinitionListItem term={t(($) => $.confirm.email)}>
                    <span className="text-nowrap">{userInfo.email}</span>
                  </DefinitionListItem>
                )}
              </DefinitionList>
            </section>

            <section className="space-y-6">
              <h3 className="font-lato text-2xl font-bold">{t(($) => $.confirm.dentalInsurance)}</h3>
              <DefinitionList border>
                <DefinitionListItem term={t(($) => $.confirm.dentalPrivate)}>{dentalInsurance.hasDentalInsurance ? t(($) => $.confirm.yes) : t(($) => $.confirm.no)}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.confirm.dentalPublic)}>
                  {dentalBenefits.federalGovernmentInsurancePlan || dentalBenefits.provincialGovernmentInsurancePlan ? (
                    <div className="space-y-3">
                      <p>{t(($) => $.confirm.yes)}</p>
                      <p>{t(($) => $.confirm.dentalBenefitHasAccess)}</p>
                      <ul className="list-disc space-y-1 pl-7">
                        {dentalBenefits.federalGovernmentInsurancePlan && <li>{dentalBenefits.federalGovernmentInsurancePlan.name}</li>}
                        {dentalBenefits.provincialGovernmentInsurancePlan && <li>{dentalBenefits.provincialGovernmentInsurancePlan.name}</li>}
                      </ul>
                    </div>
                  ) : (
                    <>{t(($) => $.confirm.no)}</>
                  )}
                </DefinitionListItem>
              </DefinitionList>
            </section>
          </section>

          <div className="mb-8 space-y-10">
            {children.map((child) => {
              return (
                <section key={child.id} className="space-y-10">
                  <h2 className="font-lato text-3xl font-bold">{child.firstName}</h2>
                  <div>
                    <h3 className="font-lato mb-6 text-2xl font-bold">
                      {t(($) => $.confirm.pageSubTitle, {
                        child: child.firstName,
                      })}
                    </h3>
                    <DefinitionList border>
                      <DefinitionListItem term={t(($) => $.confirm.memberId)}>{child.memberId}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.confirm.fullName)}>{`${child.firstName} ${child.lastName}`}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.confirm.dob)}>{child.dateOfBirth}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.confirm.sin)}>{child.socialInsuranceNumber && formatSin(child.socialInsuranceNumber)}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.confirm.isParent)}>{child.isParent ? t(($) => $.confirm.yes) : t(($) => $.confirm.no)}</DefinitionListItem>
                    </DefinitionList>
                  </div>
                  <div>
                    <h3 className="font-lato mb-6 text-2xl font-bold">
                      {t(($) => $.confirm.dentalTitle, {
                        child: child.firstName,
                      })}
                    </h3>
                    <DefinitionList border>
                      <DefinitionListItem term={t(($) => $.confirm.dentalPrivate)}>{child.hasDentalInsurance ? t(($) => $.confirm.yes) : t(($) => $.confirm.no)}</DefinitionListItem>
                      <DefinitionListItem term={t(($) => $.confirm.dentalPublic)}>
                        {child.dentalBenefits.federalGovernmentInsurancePlan || child.dentalBenefits.provincialGovernmentInsurancePlan ? (
                          <div className="space-y-3">
                            <p>{t(($) => $.confirm.yes)}</p>
                            <p>{t(($) => $.confirm.dentalBenefitHasAccess)}</p>
                            <ul className="list-disc space-y-1 pl-7">
                              {child.dentalBenefits.federalGovernmentInsurancePlan && <li>{child.dentalBenefits.federalGovernmentInsurancePlan.name}</li>}
                              {child.dentalBenefits.provincialGovernmentInsurancePlan && <li>{child.dentalBenefits.provincialGovernmentInsurancePlan.name}</li>}
                            </ul>
                          </div>
                        ) : (
                          <>{t(($) => $.confirm.no)}</>
                        )}
                      </DefinitionListItem>
                    </DefinitionList>
                  </div>
                </section>
              );
            })}
          </div>
        </section>
        <div className="my-6 print:hidden">
          <PrintButton size="lg" variant="primary" errorMessage={t(($) => $.confirm.printUnavailable)} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Print bottom - Application successfully submitted click">
            {t(($) => $.confirm.printBtn)}
          </PrintButton>
        </div>
        <Dialog>
          <DialogTrigger className="print:hidden" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Exit - Application successfully submitted click" asChild>
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
                <Button id="confirm-modal-back" variant="secondary" size="sm" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Back exit modal - Application successfully submitted click">
                  {t(($) => $.confirm.modal.backBtn)}
                </Button>
              </DialogClose>
              <fetcher.Form method="post" noValidate>
                <CsrfTokenInput />
                <Button id="confirm-modal-close" variant="primary" size="sm" onClick={() => removeApplicationFlowStorageValue()} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Family:Close confirm modal click">
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
