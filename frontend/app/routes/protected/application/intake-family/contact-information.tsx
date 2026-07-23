import { faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/contact-information';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationIntakeFamilyState } from '~/.server/routes/helpers/protected-application-intake-family-route-helpers';
import { isAddressSectionCompleted, isCommunicationPreferencesSectionCompleted, isEmailSectionCompleted, isPhoneNumberSectionCompleted } from '~/.server/routes/helpers/protected-application-intake-section-checks';
import { validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { Address } from '~/components/address';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/protected/application/intake-family/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.intakeFamily.contactInformation,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationIntakeFamilyState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['intake-family']);

  const t = await getFixedT(url, ['protectedApplicationIntakeFamily', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.contactInformation.pageTitle) }),
  };
  const locale = getLocale(url);

  const mailingAddressInfo = state.mailingAddress?.hasChanged
    ? {
        address: state.mailingAddress.value.address,
        city: state.mailingAddress.value.city,
        province: state.mailingAddress.value.province ? await appContainer.get(TYPES.ProvinceTerritoryStateService).getLocalizedProvinceTerritoryStateById(state.mailingAddress.value.province, locale) : undefined,
        postalCode: state.mailingAddress.value.postalCode,
        country: await appContainer.get(TYPES.CountryService).getLocalizedCountryById(state.mailingAddress.value.country, locale),
      }
    : undefined;

  const homeAddressInfo = state.homeAddress?.hasChanged
    ? {
        address: state.homeAddress.value.address,
        city: state.homeAddress.value.city,
        province: state.homeAddress.value.province ? await appContainer.get(TYPES.ProvinceTerritoryStateService).getLocalizedProvinceTerritoryStateById(state.homeAddress.value.province, locale) : undefined,
        postalCode: state.homeAddress.value.postalCode,
        country: await appContainer.get(TYPES.CountryService).getLocalizedCountryById(state.homeAddress.value.country, locale),
      }
    : undefined;

  return {
    state: {
      phoneNumber: state.phoneNumber,
      communicationPreferences: state.communicationPreferences,
      email: state.email,
    },
    mailingAddressInfo,
    homeAddressInfo,
    preferredLanguage: state.communicationPreferences?.hasChanged ? appContainer.get(TYPES.LanguageService).getLocalizedLanguageById(state.communicationPreferences.value.preferredLanguage, locale) : undefined,
    preferredMethod: state.communicationPreferences?.hasChanged ? appContainer.get(TYPES.SunLifeCommunicationMethodService).getLocalizedSunLifeCommunicationMethodById(state.communicationPreferences.value.preferredMethod, locale) : undefined,
    sections: {
      phoneNumber: { completed: isPhoneNumberSectionCompleted(state) },
      address: { completed: isAddressSectionCompleted(state) },
      communicationPreferences: { completed: isCommunicationPreferencesSectionCompleted(state) },
      email: { completed: isEmailSectionCompleted(state) },
    },
    meta,
  };
}

export default function NewFamilyContactInformation({ loaderData, params }: Route.ComponentProps) {
  const { state, mailingAddressInfo, homeAddressInfo, preferredLanguage, preferredMethod, sections } = loaderData;
  const { t } = useTranslation(['protectedApplicationIntakeFamily', 'protectedApplication']);

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  return (
    <>
      <AppPageTitle>{t(($) => $.contactInformation.pageHeading)}</AppPageTitle>
      <ProgressStepper activeStep="contactInformation" className="mb-8" />
      <div className="max-w-prose space-y-8">
        <div className="space-y-4">
          <p>{t(($) => $.completeAllSections, { ns: 'protectedApplication' })}</p>
          <p>{completedSectionsLabel}</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.contactInformation.phoneNumber)}</h2>
            </CardTitle>
            <CardAction>{sections.phoneNumber.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {state.phoneNumber?.hasChanged ? (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.contactInformation.phoneNumber)}>{state.phoneNumber.value.primary}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.contactInformation.altPhoneNumber)}>{state.phoneNumber.value.alternate ?? t(($) => $.contactInformation.none)}</DefinitionListItem>
              </DefinitionList>
            ) : (
              <p>{t(($) => $.contactInformation.phoneNumberHelp)}</p>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-phone-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/phone-number"
              params={params}
              startIcon={sections.phoneNumber.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit phone click"
            >
              {sections.phoneNumber.completed ? t(($) => $.contactInformation.editPhoneNumber) : t(($) => $.contactInformation.addPhoneNumber)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.contactInformation.mailingAndHomeAddress)}</h2>
            </CardTitle>
            <CardAction>{sections.address.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {mailingAddressInfo === undefined || homeAddressInfo === undefined ? (
              <p>{t(($) => $.contactInformation.addressHelp)}</p>
            ) : (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.contactInformation.mailingAddress)}>
                  <Address
                    address={{
                      address: mailingAddressInfo.address,
                      city: mailingAddressInfo.city,
                      provinceState: mailingAddressInfo.province?.abbr,
                      postalZipCode: mailingAddressInfo.postalCode,
                      country: mailingAddressInfo.country.name,
                    }}
                  />
                </DefinitionListItem>
                <DefinitionListItem term={t(($) => $.contactInformation.homeAddress)}>
                  <Address
                    address={{
                      address: homeAddressInfo.address,
                      city: homeAddressInfo.city,
                      provinceState: homeAddressInfo.province?.abbr,
                      postalZipCode: homeAddressInfo.postalCode,
                      country: homeAddressInfo.country.name,
                    }}
                  />
                </DefinitionListItem>
              </DefinitionList>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-address-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/mailing-address"
              params={params}
              startIcon={sections.address.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit address click"
            >
              {sections.address.completed ? t(($) => $.contactInformation.editAddress) : t(($) => $.contactInformation.addAddress)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.contactInformation.communicationPreferences)}</h2>
            </CardTitle>
            <CardAction>{sections.communicationPreferences.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>
            {state.communicationPreferences?.hasChanged ? (
              <DefinitionList layout="single-column">
                <DefinitionListItem term={t(($) => $.contactInformation.preferredLanguage)}>{preferredLanguage?.name}</DefinitionListItem>
                <DefinitionListItem term={t(($) => $.contactInformation.preferredMethod)}>{preferredMethod?.name}</DefinitionListItem>
              </DefinitionList>
            ) : (
              <p>{t(($) => $.contactInformation.communicationPreferencesHelp)}</p>
            )}
          </CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-comms-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/communication-preferences"
              params={params}
              startIcon={sections.communicationPreferences.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit comms click"
            >
              {sections.communicationPreferences.completed ? t(($) => $.contactInformation.editCommunicationPreferences) : t(($) => $.contactInformation.addCommunicationPreferences)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle asChild>
              <h2>{t(($) => $.contactInformation.email)}</h2>
            </CardTitle>
            <CardAction>{sections.email.completed && <StatusTag status="complete" />}</CardAction>
          </CardHeader>
          <CardContent>{state.email === undefined ? <p>{t(($) => $.contactInformation.emailHelp)}</p> : <p>{state.email}</p>}</CardContent>
          <CardFooter className="border-t bg-zinc-100">
            <ButtonLink
              id="edit-email-button"
              variant="link"
              className="p-0"
              routeId="protected/application/$id/email"
              params={params}
              startIcon={sections.email.completed ? faPenToSquare : faCirclePlus}
              size="lg"
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Edit email click"
            >
              {sections.email.completed ? t(($) => $.contactInformation.editEmail) : t(($) => $.contactInformation.addEmail)}
            </ButtonLink>
          </CardFooter>
        </Card>

        <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
          <NavigationButtonLink
            disabled={!allSectionsCompleted}
            variant="primary"
            direction="next"
            routeId="protected/application/$id/intake-family/dental-insurance"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Continue click"
          >
            {t(($) => $.contactInformation.nextBtn)}
          </NavigationButtonLink>
          <NavigationButtonLink
            variant="secondary"
            direction="previous"
            routeId="protected/application/$id/intake-family/marital-status"
            params={params}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Intake_Family:Back click"
          >
            {t(($) => $.contactInformation.prevBtn)}
          </NavigationButtonLink>
        </div>
      </div>
    </>
  );
}
