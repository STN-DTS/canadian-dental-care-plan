import { useMemo, useState } from 'react';
import type { JSX } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/home-address';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AddressInvalidDialogContent, AddressSuggestionDialogContent } from '~/components/address-validation-dialog';
import type { AddressInvalidResponse, AddressResponse, AddressSuggestionResponse, CanadianAddress } from '~/components/address-validation-dialog';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { Dialog, DialogTrigger } from '~/components/dialog';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import type { InputOptionProps } from '~/components/input-option';
import { InputSanitizeField } from '~/components/input-sanitize-field';
import { InputSelect } from '~/components/input-select';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { useClientEnv } from '~/root';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { formatAddressLine } from '~/utils/string-utils';

const FORM_ACTION = {
  submit: 'submit',
  cancel: 'cancel',
  useInvalidAddress: 'use-invalid-address',
  useSelectedAddress: 'use-selected-address',
} as const;

export const handle = {
  i18nPreloadNamespace: ['protectedProfile', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.profile.editHomeAddress,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  const { t } = useTranslation('protectedProfile');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.contactInformation.pageTitle),
          routeId: 'protected/profile/contact-information',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });

  const t = await getFixedT(url, ['protectedProfile', 'gcweb']);
  const locale = getLocale(url);

  const countryList = await appContainer.get(TYPES.CountryService).listAndSortLocalizedCountries(locale);
  const regionList = await appContainer.get(TYPES.ProvinceTerritoryStateService).listAndSortLocalizedProvinceTerritoryStates(locale);

  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.homeAddress.pageTitle) }),
  };

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.profile.home-address', { userId: idToken.sub });

  return {
    meta,
    defaultState: {
      address: clientApplication.contactInformation.homeAddress?.address,
      apartment: clientApplication.contactInformation.homeAddress?.apartment,
      city: clientApplication.contactInformation.homeAddress?.city,
      postalCode: clientApplication.contactInformation.homeAddress?.postalCode,
      province: clientApplication.contactInformation.homeAddress?.province,
      country: clientApplication.contactInformation.homeAddress?.country,
    },
    countryList,
    regionList,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();
  const locale = getLocale(url);

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });

  const clientConfig = appContainer.get(TYPES.ClientConfig);
  const addressValidationService = appContainer.get(TYPES.AddressValidationService);
  const countryService = appContainer.get(TYPES.CountryService);
  const provinceTerritoryStateService = appContainer.get(TYPES.ProvinceTerritoryStateService);

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  const homeAddressValidator = appContainer.get(TYPES.HomeAddressValidatorFactory).createHomeAddressValidator(locale);
  const validatedResult = await homeAddressValidator.validateHomeAddress({
    address: formData.get('address')?.toString(),
    apartment: formData.get('apartment')?.toString(),
    countryId: formData.get('countryId')?.toString(),
    provinceStateId: formData.get('provinceStateId')?.toString(),
    city: formData.get('city')?.toString(),
    postalZipCode: formData.get('postalZipCode')?.toString(),
  });

  if (!validatedResult.success) {
    return data({ errors: validatedResult.errors }, { status: 400 });
  }

  const formattedAddress = formatAddressLine({ address: validatedResult.data.address, apartment: validatedResult.data.apartment });

  const homeAddress = {
    address: formattedAddress,
    city: validatedResult.data.city,
    countryId: validatedResult.data.countryId,
    postalZipCode: validatedResult.data.postalZipCode,
    provinceStateId: validatedResult.data.provinceStateId,
  };

  const isNotCanada = validatedResult.data.countryId !== clientConfig.CANADA_COUNTRY_ID;
  const isUseInvalidAddressAction = formAction === FORM_ACTION.useInvalidAddress;
  const isUseSelectedAddressAction = formAction === FORM_ACTION.useSelectedAddress;
  const canProceed = isNotCanada || isUseInvalidAddressAction || isUseSelectedAddressAction;

  const idToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('update-data.profile.home-address', { userId: idToken.sub });

  if (canProceed) {
    await appContainer.get(TYPES.ProfileService).updateAddresses(
      {
        clientId: clientApplication.applicantInformation.clientId,
        mailingAddress: {
          address: clientApplication.contactInformation.mailingAddress.address,
          city: clientApplication.contactInformation.mailingAddress.city,
          countryId: clientApplication.contactInformation.mailingAddress.country,
          postalZipCode: clientApplication.contactInformation.mailingAddress.postalCode,
          provinceStateId: clientApplication.contactInformation.mailingAddress.province,
        },
        homeAddress,
      },
      idToken.sub,
    );
    return redirect(getPathById('protected/profile/contact-information', params));
  }

  // Validate Canadian adddress
  invariant(validatedResult.data.postalZipCode, 'Postal zip code is required for Canadian addresses');
  invariant(validatedResult.data.provinceStateId, 'Province state is required for Canadian addresses');

  const country = await countryService.getLocalizedCountryById(validatedResult.data.countryId, locale);
  const provinceTerritoryState = await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(validatedResult.data.provinceStateId, locale);

  // Build the address object using validated data, transforming unique identifiers
  const formattedHomeAddress: CanadianAddress = {
    address: formattedAddress,
    city: validatedResult.data.city,
    countryId: validatedResult.data.countryId,
    country: country.name,
    postalZipCode: validatedResult.data.postalZipCode,
    provinceStateId: validatedResult.data.provinceStateId,
    provinceState: validatedResult.data.provinceStateId && provinceTerritoryState.abbr,
  };

  const addressCorrectionResult = await addressValidationService.getAddressCorrectionResult({
    address: formattedHomeAddress.address,
    city: formattedHomeAddress.city,
    postalCode: formattedHomeAddress.postalZipCode,
    provinceCode: formattedHomeAddress.provinceState,
    userId: 'anonymous',
  });

  if (addressCorrectionResult.status === 'not-correct') {
    return {
      invalidAddress: formattedHomeAddress,
      status: 'address-invalid',
    } as const satisfies AddressInvalidResponse;
  }

  if (addressCorrectionResult.status === 'corrected') {
    const provinceTerritoryState = await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateByCode(addressCorrectionResult.provinceCode, locale);
    return {
      enteredAddress: formattedHomeAddress,
      status: 'address-suggestion',
      suggestedAddress: {
        address: addressCorrectionResult.address,
        city: addressCorrectionResult.city,
        country: formattedHomeAddress.country,
        countryId: formattedHomeAddress.countryId,
        postalZipCode: addressCorrectionResult.postalCode,
        provinceState: provinceTerritoryState.abbr,
        provinceStateId: provinceTerritoryState.id,
      },
    } as const satisfies AddressSuggestionResponse;
  }

  await appContainer.get(TYPES.ProfileService).updateAddresses(
    {
      clientId: clientApplication.applicantInformation.clientId,
      mailingAddress: {
        address: clientApplication.contactInformation.mailingAddress.address,
        city: clientApplication.contactInformation.mailingAddress.city,
        countryId: clientApplication.contactInformation.mailingAddress.country,
        postalZipCode: clientApplication.contactInformation.mailingAddress.postalCode,
        provinceStateId: clientApplication.contactInformation.mailingAddress.province,
      },
      homeAddress,
    },
    idToken.sub,
  );
  return redirect(getPathById('protected/profile/contact-information', params));
}

export default function EditHomeAddress({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedProfile');
  const { defaultState, countryList, regionList } = loaderData;
  const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = useClientEnv();

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const [selectedHomeCountry, setSelectedHomeCountry] = useState(defaultState.country ?? CANADA_COUNTRY_ID);
  const [addressDialogContent, setAddressDialogContent] = useState<AddressResponse>();
  const homeCountryRegions = useMemo(() => regionList.filter(({ countryId }) => countryId === selectedHomeCountry), [regionList, selectedHomeCountry]);

  const errors = fetcher.data && 'errors' in fetcher.data ? fetcher.data.errors : undefined;
  const fetcherAddressResponse = fetcher.data && 'status' in fetcher.data && typeof fetcher.data.status === 'string' ? fetcher.data : undefined;

  // Adjust the state while rendering to ensure the dialog opens when the address response changes
  const [prevFetcherAddressResponse, setPrevFetcherAddressResponse] = useState(fetcherAddressResponse);
  if (prevFetcherAddressResponse !== fetcherAddressResponse) {
    setPrevFetcherAddressResponse(fetcherAddressResponse);
    if (fetcherAddressResponse) {
      setAddressDialogContent(fetcherAddressResponse);
    }
  }

  function onDialogOpenChangeHandler(open: boolean) {
    if (!open) {
      setAddressDialogContent(undefined);
    }
  }

  const homeCountryChangeHandler = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    setSelectedHomeCountry(event.currentTarget.value);
  };

  const countries = useMemo<InputOptionProps[]>(() => {
    return countryList.map(({ id, name }) => ({ children: name, value: id }));
  }, [countryList]);

  const homeRegions = useMemo<InputOptionProps[]>(() => homeCountryRegions.map(({ id, name }) => ({ children: name, value: id })), [homeCountryRegions]);

  const dummyOption: InputOptionProps = {
    children: t(($) => $.homeAddress.selectOne),
    value: '',
  };

  const isPostalCodeRequired = [CANADA_COUNTRY_ID, USA_COUNTRY_ID].includes(selectedHomeCountry);

  let postalCodeHelpMessage: string | undefined;
  switch (selectedHomeCountry) {
    case CANADA_COUNTRY_ID: {
      postalCodeHelpMessage = t(($) => $.homeAddress.postalCodeHelp);
      break;
    }
    case USA_COUNTRY_ID: {
      postalCodeHelpMessage = t(($) => $.homeAddress.postalCodeHelpUs);
      break;
    }
    default: {
      postalCodeHelpMessage = undefined;
      break;
    }
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.homeAddress.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.optionalLabel)}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <fieldset className="mb-6">
              <div className="space-y-6">
                <InputSanitizeField
                  id="homeAddress"
                  name="address"
                  className="w-full"
                  label={t(($) => $.homeAddress.address)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.homeAddress.addressHelp)}
                  helpMessagePrimaryClassName="text-black"
                  autoComplete="address-line1"
                  defaultValue={defaultState.address}
                  errorMessage={errors?.address}
                  required
                />
                <InputSanitizeField
                  id="apartment"
                  name="apartment"
                  className="w-full"
                  label={t(($) => $.homeAddress.apartment)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.homeAddress.apartmentHelp)}
                  helpMessagePrimaryClassName="text-black"
                  autoComplete="address-line2"
                  defaultValue={defaultState.apartment}
                  errorMessage={errors?.apartment}
                />
                <InputSanitizeField id="home-city" name="city" className="w-full" label={t(($) => $.homeAddress.city)} maxLength={100} autoComplete="address-level2" defaultValue={defaultState.city} errorMessage={errors?.city} required />
                <InputSanitizeField
                  id="home-postal-code"
                  name="postalZipCode"
                  className="w-full sm:w-1/2"
                  label={isPostalCodeRequired ? t(($) => $.homeAddress.postalCode) : t(($) => $.homeAddress.postalCodeOptional)}
                  maxLength={100}
                  autoComplete="postal-code"
                  defaultValue={defaultState.postalCode}
                  errorMessage={errors?.postalZipCode}
                  required={isPostalCodeRequired}
                  helpMessagePrimary={postalCodeHelpMessage}
                  helpMessagePrimaryClassName="text-black"
                />
                {homeRegions.length > 0 && (
                  <InputSelect
                    id="home-province"
                    name="provinceStateId"
                    className="w-full sm:w-1/2"
                    label={t(($) => $.homeAddress.province)}
                    defaultValue={defaultState.province}
                    errorMessage={errors?.provinceStateId}
                    options={[dummyOption, ...homeRegions]}
                    required
                  />
                )}
                <InputSelect
                  id="home-country"
                  name="countryId"
                  className="w-full sm:w-1/2"
                  label={t(($) => $.homeAddress.country)}
                  autoComplete="country"
                  defaultValue={defaultState.country}
                  errorMessage={errors?.countryId}
                  options={countries}
                  onChange={homeCountryChangeHandler}
                  required
                />
              </div>
            </fieldset>
            <div className="flex flex-row-reverse flex-wrap items-center justify-end gap-3">
              <Dialog open={addressDialogContent !== undefined} onOpenChange={onDialogOpenChangeHandler}>
                <DialogTrigger asChild>
                  <LoadingButton
                    aria-expanded={undefined}
                    variant="primary"
                    id="continue-button"
                    type="submit"
                    name="_action"
                    value={FORM_ACTION.submit}
                    loading={isSubmitting}
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Continue - Home address click"
                  >
                    {t(($) => $.homeAddress.saveBtn)}
                  </LoadingButton>
                </DialogTrigger>
                {!isSubmitting && addressDialogContent && (
                  <>
                    {addressDialogContent.status === 'address-suggestion' && (
                      <AddressSuggestionDialogContent enteredAddress={addressDialogContent.enteredAddress} suggestedAddress={addressDialogContent.suggestedAddress} formAction={FORM_ACTION.useSelectedAddress} />
                    )}
                    {addressDialogContent.status === 'address-invalid' && <AddressInvalidDialogContent addressContext="homeAddress" invalidAddress={addressDialogContent.invalidAddress} formAction={FORM_ACTION.useInvalidAddress} />}
                  </>
                )}
              </Dialog>
              <ButtonLink variant="secondary" id="back-button" routeId="protected/profile/contact-information" params={params} disabled={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Profile-Protected:Back - Home address click">
                {t(($) => $.homeAddress.backBtn)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
