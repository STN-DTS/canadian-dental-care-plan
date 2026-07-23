import type { JSX } from 'react';

import { data, useFetcher, useLoaderData, useParams } from 'react-router';

import { faCircleCheck, faPenToSquare } from '@fortawesome/free-regular-svg-icons';
import { faCirclePlus } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/parent-or-guardian';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationRenewalChildState } from '~/.server/routes/helpers/protected-application-renewal-child-route-helpers';
import { isAddressSectionCompleted, isCommunicationPreferencesSectionCompleted, isEmailSectionCompleted, isMaritalStatusSectionCompleted, isPhoneNumberSectionCompleted } from '~/.server/routes/helpers/protected-application-renewal-section-checks';
import { saveProtectedApplicationState, shouldSkipMaritalStatus, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { Address } from '~/components/address';
import { AppPageTitle } from '~/components/app-page-title';
import { Button, ButtonLink } from '~/components/buttons';
import { Card, CardAction, CardContent, CardFooter, CardHeader, CardTitle } from '~/components/card';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DefinitionList, DefinitionListItem } from '~/components/definition-list';
import { NavigationButtonLink } from '~/components/navigation-buttons';
import { StatusTag } from '~/components/status-tag';
import { useSectionsStatus } from '~/hooks';
import { pageIds } from '~/page-ids';
import { ProgressStepper } from '~/routes/protected/application/renewal-children/progress-stepper';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatSin } from '~/utils/sin-utils';

const FORM_ACTION = {
  PHONE_NUMBER_NOT_CHANGED: 'phone-number-not-changed',
  ADDRESS_NOT_CHANGED: 'address-not-changed',
  COMMUNICATION_PREFERENCES_NOT_CHANGED: 'communication-preferences-not-changed',
} as const;

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalChild.parentOrGuardian,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const t = await getFixedT(url, ['protectedApplicationRenewalChild', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.parentOrGuardian.pageTitle) }),
  };
  const locale = getLocale(url);

  const countryService = appContainer.get(TYPES.CountryService);
  const languageService = appContainer.get(TYPES.LanguageService);
  const provinceTerritoryStateService = appContainer.get(TYPES.ProvinceTerritoryStateService);
  const sunLifeCommunicationMethodService = appContainer.get(TYPES.SunLifeCommunicationMethodService);
  const gcCommunicationMethodService = appContainer.get(TYPES.GCCommunicationMethodService);
  const shouldSkipMaritalStatusStep = shouldSkipMaritalStatus(state);
  const { COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID, COMMUNICATION_METHOD_GC_DIGITAL_ID } = appContainer.get(TYPES.ServerConfig);

  return {
    // Application state that is relevant to the contact information page.
    state: {
      maritalStatus: state.maritalStatus ? appContainer.get(TYPES.MaritalStatusService).getLocalizedMaritalStatusById(state.maritalStatus, locale) : undefined,
      partnerInformation: state.partnerInformation,
      email: state.email,
      phoneNumber: state.phoneNumber?.hasChanged
        ? {
            primary: state.phoneNumber.value.primary,
            alternate: state.phoneNumber.value.alternate,
          }
        : undefined,
      communicationPreferences: state.communicationPreferences?.hasChanged
        ? {
            preferredLanguage: languageService.getLocalizedLanguageById(state.communicationPreferences.value.preferredLanguage, locale).name,
            preferredMethod: sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById(state.communicationPreferences.value.preferredMethod, locale).name,
          }
        : undefined,
      mailingAddress: state.mailingAddress?.hasChanged
        ? {
            address: state.mailingAddress.value.address,
            city: state.mailingAddress.value.city,
            province: state.mailingAddress.value.province //
              ? await provinceTerritoryStateService.getProvinceTerritoryStateById(state.mailingAddress.value.province)
              : undefined,
            postalCode: state.mailingAddress.value.postalCode,
            country: await countryService.getLocalizedCountryById(state.mailingAddress.value.country, locale),
          }
        : undefined,
      homeAddress: state.homeAddress?.hasChanged
        ? {
            address: state.homeAddress.value.address,
            city: state.homeAddress.value.city,
            province: state.homeAddress.value.province //
              ? await provinceTerritoryStateService.getProvinceTerritoryStateById(state.homeAddress.value.province)
              : undefined,
            postalCode: state.homeAddress.value.postalCode,
            country: await countryService.getLocalizedCountryById(state.homeAddress.value.country, locale),
          }
        : undefined,
    },
    // Existing client application data that is relevant to the contact information page.
    clientApplication: {
      email: state.clientApplication.contactInformation.email,
      emailVerified: state.clientApplication.contactInformation.emailVerified,
      phoneNumber: state.clientApplication.contactInformation.phoneNumber
        ? {
            primary: state.clientApplication.contactInformation.phoneNumber,
            alternate: state.clientApplication.contactInformation.phoneNumberAlt,
          }
        : undefined,
      communicationPreferences:
        state.clientApplication.communicationPreferences.preferredMethodSunLife === COMMUNICATION_METHOD_SUNLIFE_EMAIL_ID &&
        state.clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada === COMMUNICATION_METHOD_GC_DIGITAL_ID &&
        state.clientApplication.communicationPreferences.preferredLanguage
          ? {
              preferredLanguage: languageService.getLocalizedLanguageById(state.clientApplication.communicationPreferences.preferredLanguage, locale).name,
              preferredMethod: sunLifeCommunicationMethodService.getLocalizedSunLifeCommunicationMethodById(state.clientApplication.communicationPreferences.preferredMethodSunLife, locale).name,
              preferredNotificationMethod: gcCommunicationMethodService.getLocalizedGCCommunicationMethodById(state.clientApplication.communicationPreferences.preferredMethodGovernmentOfCanada, locale).name,
            }
          : undefined,
      mailingAddress: state.clientApplication.contactInformation.mailingAddress.country
        ? {
            address: state.clientApplication.contactInformation.mailingAddress.address,
            city: state.clientApplication.contactInformation.mailingAddress.city,
            province: state.clientApplication.contactInformation.mailingAddress.province //
              ? await provinceTerritoryStateService.getProvinceTerritoryStateById(state.clientApplication.contactInformation.mailingAddress.province)
              : undefined,
            postalCode: state.clientApplication.contactInformation.mailingAddress.postalCode,
            country: await countryService.getLocalizedCountryById(state.clientApplication.contactInformation.mailingAddress.country, locale),
            hasChanged: false,
          }
        : undefined,
      homeAddress: state.clientApplication.contactInformation.homeAddress
        ? {
            address: state.clientApplication.contactInformation.homeAddress.address,
            city: state.clientApplication.contactInformation.homeAddress.city,
            province: state.clientApplication.contactInformation.homeAddress.province //
              ? await provinceTerritoryStateService.getProvinceTerritoryStateById(state.clientApplication.contactInformation.homeAddress.province)
              : undefined,
            postalCode: state.clientApplication.contactInformation.homeAddress.postalCode,
            country: await countryService.getLocalizedCountryById(state.clientApplication.contactInformation.homeAddress.country, locale),
            hasChanged: false,
          }
        : undefined,
    },
    shouldSkipMaritalStatusStep,
    sections: {
      ...(shouldSkipMaritalStatusStep ? {} : { maritalStatus: { completed: isMaritalStatusSectionCompleted(state) } }),
      phoneNumber: { completed: isPhoneNumberSectionCompleted(state) },
      address: { completed: isAddressSectionCompleted(state) },
      communicationPreferences: { completed: isCommunicationPreferencesSectionCompleted(state) },
      email: { completed: isEmailSectionCompleted(state) },
    },
    meta,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.PHONE_NUMBER_NOT_CHANGED) {
    saveProtectedApplicationState({
      params,
      session,
      state: {
        phoneNumber: { hasChanged: false },
      },
    });
  }

  if (formAction === FORM_ACTION.ADDRESS_NOT_CHANGED) {
    saveProtectedApplicationState({
      params,
      session,
      state: {
        mailingAddress: { hasChanged: false },
        homeAddress: { hasChanged: false },
      },
    });
  }

  if (formAction === FORM_ACTION.COMMUNICATION_PREFERENCES_NOT_CHANGED) {
    saveProtectedApplicationState({
      params,
      session,
      state: {
        communicationPreferences: {
          hasChanged: false,
        },
      },
    });
  }

  return data({ success: true }, { status: 200 });
}

export default function ProtectedRenewChildParentOrGuardian({ loaderData, params }: Route.ComponentProps) {
  const { state, sections, shouldSkipMaritalStatusStep } = loaderData;
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);

  const { completedSectionsLabel, allSectionsCompleted } = useSectionsStatus(sections);

  const fetcher = useFetcher<typeof action>();

  return (
    <>
      <AppPageTitle>{t(($) => $.parentOrGuardian.pageHeading)}</AppPageTitle>
      <fetcher.Form method="post" noValidate>
        <CsrfTokenInput />
        <ProgressStepper activeStep="parentOrGuardian" className="mb-8" />
        <div className="max-w-prose space-y-8">
          <div className="space-y-4">
            <p>{t(($) => $.completeAllSections, { ns: 'protectedApplication' })}</p>
            <p>{completedSectionsLabel}</p>
            <p>{t(($) => $.confirmInformation, { ns: 'protectedApplication' })}</p>
          </div>

          {!shouldSkipMaritalStatusStep && (
            <Card>
              <CardHeader>
                <CardTitle asChild>
                  <h2>{t(($) => $.parentOrGuardian.maritalStatus)}</h2>
                </CardTitle>
                <CardAction>{sections.maritalStatus?.completed && <StatusTag status="complete" />}</CardAction>
              </CardHeader>
              <CardContent>
                {state.maritalStatus === undefined ? (
                  <p>{t(($) => $.parentOrGuardian.selectYourStatus)}</p>
                ) : (
                  <DefinitionList layout="single-column">
                    <DefinitionListItem term={t(($) => $.parentOrGuardian.maritalStatus)}>{state.maritalStatus.name}</DefinitionListItem>
                    {state.partnerInformation && (
                      <>
                        <DefinitionListItem term={t(($) => $.parentOrGuardian.spouseSin)}>{formatSin(state.partnerInformation.socialInsuranceNumber)}</DefinitionListItem>
                        <DefinitionListItem term={t(($) => $.parentOrGuardian.spouseYob)}>{state.partnerInformation.yearOfBirth}</DefinitionListItem>
                        <DefinitionListItem term={t(($) => $.parentOrGuardian.consent)}>{t(($) => $.parentOrGuardian.consentYes)}</DefinitionListItem>
                      </>
                    )}
                  </DefinitionList>
                )}
              </CardContent>
              <CardFooter className="border-t bg-zinc-100">
                <ButtonLink
                  id="edit-marital-button"
                  variant="link"
                  className="p-0"
                  routeId="protected/application/$id/marital-status"
                  params={params}
                  startIcon={sections.maritalStatus?.completed ? faPenToSquare : faCirclePlus}
                  size="lg"
                  data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Edit marital click"
                >
                  {state.maritalStatus === undefined ? t(($) => $.parentOrGuardian.addMaritalStatus) : t(($) => $.parentOrGuardian.editMaritalStatus)}
                </ButtonLink>
              </CardFooter>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t(($) => $.parentOrGuardian.phoneNumber)}</h2>
              </CardTitle>
              <CardAction>{sections.phoneNumber.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <PhoneNumberCardContent />
            <PhoneNumberCardFooter />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t(($) => $.parentOrGuardian.mailingAndHomeAddress)}</h2>
              </CardTitle>
              <CardAction>{sections.address.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <MailingAndHomeAddressCardContent />
            <MailingAndHomeAddressCardFooter />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t(($) => $.parentOrGuardian.communicationPreferences)}</h2>
              </CardTitle>
              <CardAction>{sections.communicationPreferences.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <CommunicationPreferencesCardContent />
            <CommunicationPreferencesCardFooter />
          </Card>

          <Card>
            <CardHeader>
              <CardTitle asChild>
                <h2>{t(($) => $.parentOrGuardian.email)}</h2>
              </CardTitle>
              <CardAction>{sections.email.completed && <StatusTag status="complete" />}</CardAction>
            </CardHeader>
            <CardContent>{loaderData.state.email === undefined ? <p>{t(($) => $.parentOrGuardian.emailHelp)}</p> : <p>{loaderData.state.email}</p>}</CardContent>
            <CardFooter className="border-t bg-zinc-100">
              <ButtonLink
                id="edit-email-button"
                variant="link"
                className="p-0"
                routeId="protected/application/$id/email"
                params={params}
                startIcon={sections.email.completed ? faPenToSquare : faCirclePlus}
                size="lg"
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Edit email click"
              >
                {sections.email.completed ? t(($) => $.parentOrGuardian.editEmail) : t(($) => $.parentOrGuardian.addEmail)}
              </ButtonLink>
            </CardFooter>
          </Card>

          <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
            <NavigationButtonLink
              disabled={!allSectionsCompleted}
              variant="primary"
              direction="next"
              routeId="protected/application/$id/renewal-children/childrens-application"
              params={params}
              data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Continue click"
            >
              {t(($) => $.parentOrGuardian.nextBtn)}
            </NavigationButtonLink>
            <NavigationButtonLink variant="secondary" direction="previous" routeId="protected/application/$id/renew" params={params} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Back click">
              {t(($) => $.parentOrGuardian.prevBtn)}
            </NavigationButtonLink>
          </div>
        </div>
      </fetcher.Form>
    </>
  );
}

/**
 * This component determines what to show in the phone number card content based on whether the user has entered a new
 * phone number, whether there is an existing phone number on the client application, or if there is no phone number
 * at all. The logic is as follows:
 *
 * - If the user has entered a new phone number (state.phoneNumber is defined), show the new phone number.
 *
 * - If the user has not entered a new phone number but there is an existing phone number on the client application,
 *   show the existing phone number.
 *
 * - If there is no phone number on the client application and the user has not entered a new phone number, show the
 *   help text.
 *
 * This logic ensures that the user always sees a phone number if there is one available, whether it's the new one they
 * entered or the existing one on their application. If there is no phone number at all, it prompts them to add one.
 */
function PhoneNumberCardContent(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication } = useLoaderData<typeof loader>();

  if (state.phoneNumber) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.phoneNumber)}>{state.phoneNumber.primary}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.altPhoneNumber)}>{state.phoneNumber.alternate ?? t(($) => $.parentOrGuardian.none)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  if (clientApplication.phoneNumber) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.phoneNumber)}>{clientApplication.phoneNumber.primary}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.altPhoneNumber)}>{clientApplication.phoneNumber.alternate ?? t(($) => $.parentOrGuardian.none)}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.parentOrGuardian.phoneNumberHelp)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the phone number card footer based on whether the user has entered a new
 * phone number or if there is an existing phone number on the client application. The logic is as follows:
 *
 * - If the user has entered a new phone number (state.phoneNumber is defined), show the "Edit my phone number" button.
 *
 * - If the user has not entered a new phone number but there is an existing phone number on the client application,
 *   show both the "Update phone number" button and the "Phone number unchanged" button. This allows the user to either
 *   go update their phone number or confirm that their existing phone number is still correct.
 *
 * - If there is no phone number on the client application and the user has not entered a new phone number, show the
 *   "Add phone number" button.
 *
 * This logic ensures that the user always has a clear call to action based on their current state. If they have made
 * a change, they can edit it. If they haven't made a change but have an existing phone number, they can either update
 * it or confirm it's unchanged. If they don't have a phone number at all, they are prompted to add one.
 *
 * @returns
 */
function PhoneNumberCardFooter(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication, sections } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.phoneNumber || sections.phoneNumber.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-phone-button"
          variant="link"
          className="p-0"
          routeId="protected/application/$id/phone-number"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Edit phone click"
        >
          {t(($) => $.parentOrGuardian.editPhoneNumber)}
        </ButtonLink>
      </CardFooter>
    );
  }

  if (clientApplication.phoneNumber) {
    return (
      <CardFooter className="divide-y border-t bg-zinc-100 px-0">
        <div className="w-full px-6">
          <ButtonLink
            id="update-phone-button"
            variant="link"
            className="mb-5 p-0"
            routeId="protected/application/$id/phone-number"
            params={params}
            startIcon={faPenToSquare}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Update phone click"
          >
            {t(($) => $.parentOrGuardian.updatePhoneNumber)}
          </ButtonLink>
        </div>
        <div className="w-full px-6">
          <Button
            id="complete-phone-button"
            variant="link"
            name="_action"
            value={FORM_ACTION.PHONE_NUMBER_NOT_CHANGED}
            className="mt-5 p-0"
            startIcon={faCircleCheck}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Complete phone click"
          >
            <span className="text-left">{t(($) => $.parentOrGuardian.phoneNumberUnchanged)}</span>
          </Button>
        </div>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id="add-phone-button"
        variant="link"
        className="p-0"
        routeId="protected/application/$id/phone-number"
        params={params}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Add phone click"
      >
        {t(($) => $.parentOrGuardian.addPhoneNumber)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the mailing and home address card content based on whether the user has
 * entered a new mailing and home address, whether there is an existing mailing and home address on the client
 * application, or if there is no mailing and home address at all. The logic is as follows:
 *
 * - If the user has entered a new mailing and home address (state.mailingAddress and state.homeAddress are defined),
 *   show the new mailing and home address.
 *
 * - If the user has not entered a new mailing and home address but there is an existing mailing and home address on
 *   the client application, show the existing mailing and home address.
 *
 * - If there is no mailing and home address on the client application and the user has not entered a new mailing and
 *   home address, show the help text.
 *
 * This logic ensures that the user always sees a mailing and home address if there is one available, whether it's the
 * new one they entered or the existing one on their application. If there is no mailing and home address at all, it
 * prompts them to add one.
 */
function MailingAndHomeAddressCardContent(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication } = useLoaderData<typeof loader>();

  if (state.mailingAddress && state.homeAddress) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.mailingAddress)}>
            <Address
              address={{
                address: state.mailingAddress.address,
                city: state.mailingAddress.city,
                provinceState: state.mailingAddress.province?.abbr,
                postalZipCode: state.mailingAddress.postalCode,
                country: state.mailingAddress.country.name,
              }}
            />
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.homeAddress)}>
            <Address
              address={{
                address: state.homeAddress.address,
                city: state.homeAddress.city,
                provinceState: state.homeAddress.province?.abbr,
                postalZipCode: state.homeAddress.postalCode,
                country: state.homeAddress.country.name,
              }}
            />
          </DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  if (clientApplication.mailingAddress && clientApplication.homeAddress) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.mailingAddress)}>
            <Address
              address={{
                address: clientApplication.mailingAddress.address,
                city: clientApplication.mailingAddress.city,
                provinceState: clientApplication.mailingAddress.province?.abbr,
                postalZipCode: clientApplication.mailingAddress.postalCode,
                country: clientApplication.mailingAddress.country.name,
              }}
            />
          </DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.homeAddress)}>
            <Address
              address={{
                address: clientApplication.homeAddress.address,
                city: clientApplication.homeAddress.city,
                provinceState: clientApplication.homeAddress.province?.abbr,
                postalZipCode: clientApplication.homeAddress.postalCode,
                country: clientApplication.homeAddress.country.name,
              }}
            />
          </DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.parentOrGuardian.addressHelp)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the mailing and home address card footer based on whether the user has
 * entered a new mailing and home address or if there is an existing mailing and home address on the client
 * application. The logic is as follows:
 *
 * - If the user has entered a new mailing and home address (state.mailingAddress and state.homeAddress are defined),
 *   show the "Edit address" button.
 *
 * - If the user has not entered a new mailing and home address but there is an existing mailing and home address on
 *   the client application, show both the "Update address" button and the "Address unchanged" button. This allows the
 *   user to either go update their mailing and home address or confirm that their existing mailing and home address
 *   is still correct.
 *
 * - If there is no mailing and home address on the client application and the user has not entered a new mailing and
 *   home address, show the "Add address" button.
 *
 * This logic ensures that the user always has a clear call to action based on their current state. If they have made
 * a change, they can edit it. If they haven't made a change but have an existing mailing and home address, they can
 * either update it or confirm it's unchanged. If they don't have a mailing and home address at all, they are prompted
 * to add one.
 */
function MailingAndHomeAddressCardFooter(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication, sections } = useLoaderData<typeof loader>();
  const params = useParams();

  if ((state.mailingAddress && state.homeAddress) || sections.address.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-address-button"
          variant="link"
          className="p-0"
          routeId="protected/application/$id/mailing-address"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Edit address click"
        >
          {t(($) => $.parentOrGuardian.editAddress)}
        </ButtonLink>
      </CardFooter>
    );
  }

  if (clientApplication.mailingAddress && clientApplication.homeAddress) {
    return (
      <CardFooter className="divide-y border-t bg-zinc-100 px-0">
        <div className="w-full px-6">
          <ButtonLink
            id="update-address-button"
            variant="link"
            className="mb-5 p-0"
            routeId="protected/application/$id/mailing-address"
            params={params}
            startIcon={faPenToSquare}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Update address click"
          >
            {t(($) => $.parentOrGuardian.updateAddress)}
          </ButtonLink>
        </div>
        <div className="w-full px-6">
          <Button
            id="complete-address-button"
            variant="link"
            className="mt-5 p-0"
            name="_action"
            value={FORM_ACTION.ADDRESS_NOT_CHANGED}
            startIcon={faCircleCheck}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Complete address click"
          >
            <span className="text-left">{t(($) => $.parentOrGuardian.addressUnchanged)}</span>
          </Button>
        </div>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id="add-address-button"
        variant="link"
        className="p-0"
        routeId="protected/application/$id/mailing-address"
        params={params}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Add address click"
      >
        {t(($) => $.parentOrGuardian.addAddress)}
      </ButtonLink>
    </CardFooter>
  );
}

/**
 * This component determines what to show in the communication preferences card content based on whether the user has
 * entered new communication preferences, whether there are existing communication preferences on the client
 * application, or if there are no communication preferences at all. The logic is as follows:
 *
 * - If the user has entered new communication preferences (state.communicationPreferences is defined), show the new
 *   communication preferences.
 *
 * - If the user has not entered new communication preferences but there are existing communication preferences on the
 *   client application, show the existing communication preferences.
 *
 * - If there are no communication preferences on the client application and the user has not entered new
 *   communication preferences, show the help text.
 *
 * This logic ensures that the user always sees communication preferences if there are any available, whether it's the
 * new ones they entered or the existing ones on their application. If there are no communication preferences at all,
 * it prompts them to add them.
 */
function CommunicationPreferencesCardContent(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication } = useLoaderData<typeof loader>();

  if (state.communicationPreferences) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.preferredLanguage)}>{state.communicationPreferences.preferredLanguage}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.preferredMethod)}>{state.communicationPreferences.preferredMethod}</DefinitionListItem>
        </DefinitionList>
      </CardContent>
    );
  }

  if (clientApplication.communicationPreferences) {
    return (
      <CardContent>
        <DefinitionList layout="single-column">
          <DefinitionListItem term={t(($) => $.parentOrGuardian.preferredLanguage)}>{clientApplication.communicationPreferences.preferredLanguage}</DefinitionListItem>
          <DefinitionListItem term={t(($) => $.parentOrGuardian.preferredMethod)}>{clientApplication.communicationPreferences.preferredMethod}</DefinitionListItem>{' '}
        </DefinitionList>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <p>{t(($) => $.parentOrGuardian.communicationPreferencesHelp)}</p>
    </CardContent>
  );
}

/**
 * This component determines what to show in the communication preferences card footer based on whether the user has
 * entered new communication preferences or if there are existing communication preferences on the client
 * application. The logic is as follows:
 *
 * - If the user has entered new communication preferences (state.communicationPreferences is defined), show the "Edit
 *   communication preferences" button.
 *
 * - If the user has not entered new communication preferences but there are existing communication preferences on the
 *   client application, show both the "Update communication preferences" button and the "Communication preferences
 *   unchanged" button. This allows the user to either go update their communication preferences or confirm that their
 *   existing communication preferences are still correct.
 *
 * - If there are no communication preferences on the client application and the user has not entered new
 *   communication preferences, show the "Add communication preferences" button.
 *
 * This logic ensures that the user always has a clear call to action based on their current state. If they have made a
 * change, they can edit it. If they haven't made a change but have existing communication preferences, they can either
 * update it or confirm it's unchanged. If they don't have communication preferences at all, they are prompted to add them.
 */
function CommunicationPreferencesCardFooter(): JSX.Element {
  const { t } = useTranslation(['protectedApplicationRenewalChild', 'protectedApplication']);
  const { state, clientApplication, sections } = useLoaderData<typeof loader>();
  const params = useParams();

  if (state.communicationPreferences || sections.communicationPreferences.completed) {
    return (
      <CardFooter className="border-t bg-zinc-100">
        <ButtonLink
          id="edit-comms-button"
          variant="link"
          className="p-0"
          routeId="protected/application/$id/communication-preferences"
          params={params}
          startIcon={faPenToSquare}
          size="lg"
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Edit comms click"
        >
          {t(($) => $.parentOrGuardian.editCommunicationPreferences)}
        </ButtonLink>
      </CardFooter>
    );
  }

  if (clientApplication.communicationPreferences) {
    return (
      <CardFooter className="divide-y border-t bg-zinc-100 px-0">
        <div className="w-full px-6">
          <ButtonLink
            id="update-comms-button"
            variant="link"
            className="mb-5 p-0"
            routeId="protected/application/$id/communication-preferences"
            params={params}
            startIcon={faPenToSquare}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Update comms click"
          >
            {t(($) => $.parentOrGuardian.updateCommunicationPreferences)}
          </ButtonLink>
        </div>
        <div className="w-full px-6">
          <Button
            id="complete-comms-button"
            variant="link"
            name="_action"
            value={FORM_ACTION.COMMUNICATION_PREFERENCES_NOT_CHANGED}
            className="mt-5 p-0"
            startIcon={faCircleCheck}
            size="lg"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Complete comms click"
          >
            <span className="text-left">{t(($) => $.parentOrGuardian.communicationPreferencesUnchanged)}</span>
          </Button>
        </div>
      </CardFooter>
    );
  }

  return (
    <CardFooter className="border-t bg-zinc-100">
      <ButtonLink
        id="add-comms-button"
        variant="link"
        className="p-0"
        routeId="protected/application/$id/communication-preferences"
        params={params}
        startIcon={faCirclePlus}
        size="lg"
        data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Add comms click"
      >
        {t(($) => $.parentOrGuardian.addCommunicationPreferences)}
      </ButtonLink>
    </CardFooter>
  );
}
