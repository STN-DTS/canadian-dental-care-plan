import { useMemo, useState } from 'react';

import { data, redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/mailing-address';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getPublicApplicationState, savePublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import type { ApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import type { AddressInvalidResponse, AddressResponse, AddressSuggestionResponse, CanadianAddress } from '~/components/address-validation-dialog';
import { AddressInvalidDialogContent, AddressSuggestionDialogContent } from '~/components/address-validation-dialog';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { Dialog, DialogTrigger } from '~/components/dialog';
import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-context';
import { InputCheckbox } from '~/components/input-checkbox';
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
  useInvalidAddress: 'use-invalid-address',
  useSelectedAddress: 'use-selected-address',
} as const;

function getRouteFromApplicationFlow(applicationFlow: ApplicationFlow) {
  switch (applicationFlow) {
    case 'full-children': {
      return `public/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    case 'simplified-children': {
      return `public/application/$id/${applicationFlow}/parent-or-guardian`;
    }
    default: {
      return `public/application/$id/${applicationFlow}/contact-information`;
    }
  }
}

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.mailingAddress,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family', 'simplified-children']);

  const t = await getFixedT(request, ['applicationSpokes', 'gcweb']);
  const locale = getLocale(request);
  const countryList = await appContainer.get(TYPES.CountryService).listAndSortLocalizedCountries(locale);
  const regionList = await appContainer.get(TYPES.ProvinceTerritoryStateService).listAndSortLocalizedProvinceTerritoryStates(locale);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.address.mailingAddress.pageTitle) }),
  };

  return {
    defaultState: {
      address: state.mailingAddress?.value?.address,
      city: state.mailingAddress?.value?.city,
      postalCode: state.mailingAddress?.value?.postalCode,
      province: state.mailingAddress?.value?.province,
      country: state.mailingAddress?.value?.country,
      isHomeAddressSameAsMailingAddress: state.isHomeAddressSameAsMailingAddress,
    },
    applicationFlow: `${state.inputModel}-${state.typeOfApplication}` as const,
    countryList,
    regionList,
    meta,
  };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family', 'simplified-children']);

  const formData = await request.formData();
  const locale = getLocale(request);

  const clientConfig = appContainer.get(TYPES.ClientConfig);
  const addressValidationService = appContainer.get(TYPES.AddressValidationService);
  const countryService = appContainer.get(TYPES.CountryService);
  const provinceTerritoryStateService = appContainer.get(TYPES.ProvinceTerritoryStateService);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);

  securityHandler.validateCsrfToken({ formData, session });
  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));
  const isCopyMailingToHome = formData.get('syncAddresses') === 'true';

  const applicationFlow: ApplicationFlow = `${state.inputModel}-${state.typeOfApplication}`;

  const mailingAddressValidator = appContainer.get(TYPES.MailingAddressValidatorFactory).createMailingAddressValidator(locale);
  const parsedDataResult = await mailingAddressValidator.validateMailingAddress({
    address: formData.get('address')?.toString(),
    apartment: formData.get('apartment')?.toString(),
    countryId: formData.get('countryId')?.toString(),
    provinceStateId: formData.get('provinceStateId')?.toString(),
    city: formData.get('city')?.toString(),
    postalZipCode: formData.get('postalZipCode')?.toString(),
  });

  if (!parsedDataResult.success) {
    return data({ errors: parsedDataResult.errors }, { status: 400 });
  }

  const formattedAddress = formatAddressLine({ address: parsedDataResult.data.address, apartment: parsedDataResult.data.apartment });

  const mailingAddress = {
    address: formattedAddress,
    city: parsedDataResult.data.city,
    country: parsedDataResult.data.countryId,
    postalCode: parsedDataResult.data.postalZipCode,
    province: parsedDataResult.data.provinceStateId,
  };

  const homeAddress = isCopyMailingToHome ? { ...mailingAddress } : undefined;

  const isNotCanada = parsedDataResult.data.countryId !== clientConfig.CANADA_COUNTRY_ID;
  const isUseInvalidAddressAction = formAction === FORM_ACTION.useInvalidAddress;
  const isUseSelectedAddressAction = formAction === FORM_ACTION.useSelectedAddress;
  const canProceedToDental = isNotCanada || isUseInvalidAddressAction || isUseSelectedAddressAction;

  if (canProceedToDental) {
    savePublicApplicationState({
      params,
      session,
      state: {
        mailingAddress: {
          value: mailingAddress,
          hasChanged: true,
        },
        isHomeAddressSameAsMailingAddress: isCopyMailingToHome,
        ...(homeAddress && { homeAddress: { value: homeAddress, hasChanged: true } }),
      },
    });

    return redirect(isCopyMailingToHome ? getPathById(getRouteFromApplicationFlow(applicationFlow), params) : getPathById('public/application/$id/home-address', params));
  }

  // Validate Canadian address
  invariant(parsedDataResult.data.postalZipCode, 'Postal zip code is required for Canadian addresses');
  invariant(parsedDataResult.data.provinceStateId, 'Province state is required for Canadian addresses');

  const country = await countryService.getLocalizedCountryById(parsedDataResult.data.countryId, locale);
  const provinceTerritoryState = await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateById(parsedDataResult.data.provinceStateId, locale);

  // Build the address object using validated data, transforming unique identifiers
  const formattedMailingAddress: CanadianAddress = {
    address: formattedAddress,
    city: parsedDataResult.data.city,
    countryId: parsedDataResult.data.countryId,
    country: country.name,
    postalZipCode: parsedDataResult.data.postalZipCode,
    provinceStateId: parsedDataResult.data.provinceStateId,
    provinceState: parsedDataResult.data.provinceStateId && provinceTerritoryState.abbr,
  };

  const addressCorrectionResult = await addressValidationService.getAddressCorrectionResult({
    address: formattedMailingAddress.address,
    city: formattedMailingAddress.city,
    postalCode: formattedMailingAddress.postalZipCode,
    provinceCode: formattedMailingAddress.provinceState,
    userId: 'anonymous',
  });

  if (addressCorrectionResult.status === 'not-correct') {
    return {
      invalidAddress: formattedMailingAddress,
      status: 'address-invalid',
    } as const satisfies AddressInvalidResponse;
  }

  if (addressCorrectionResult.status === 'corrected') {
    const provinceTerritoryState = await provinceTerritoryStateService.getLocalizedProvinceTerritoryStateByCode(addressCorrectionResult.provinceCode, locale);
    return {
      enteredAddress: formattedMailingAddress,
      status: 'address-suggestion',
      suggestedAddress: {
        address: addressCorrectionResult.address,
        city: addressCorrectionResult.city,
        country: formattedMailingAddress.country,
        countryId: formattedMailingAddress.countryId,
        postalZipCode: addressCorrectionResult.postalCode,
        provinceState: provinceTerritoryState.abbr,
        provinceStateId: provinceTerritoryState.id,
      },
    } as const satisfies AddressSuggestionResponse;
  }

  savePublicApplicationState({
    params,
    session,
    state: {
      mailingAddress: {
        value: mailingAddress,
        hasChanged: true,
      },
      isHomeAddressSameAsMailingAddress: isCopyMailingToHome,
      ...(homeAddress && { homeAddress: { value: homeAddress, hasChanged: true } }),
    },
  });

  return redirect(isCopyMailingToHome ? getPathById(getRouteFromApplicationFlow(applicationFlow), params) : getPathById('public/application/$id/home-address', params));
}

export default function MailingAddress({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['applicationSpokes', 'application']);
  const { defaultState, countryList, regionList, applicationFlow } = loaderData;
  const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = useClientEnv();

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const [selectedMailingCountry, setSelectedMailingCountry] = useState(defaultState.country ?? CANADA_COUNTRY_ID);
  const [copyAddressChecked, setCopyAddressChecked] = useState(defaultState.isHomeAddressSameAsMailingAddress === true);
  const [addressDialogContent, setAddressDialogContent] = useState<AddressResponse>();
  const mailingCountryRegions = useMemo(() => regionList.filter(({ countryId }) => countryId === selectedMailingCountry), [regionList, selectedMailingCountry]);

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

  const checkHandler = () => {
    setCopyAddressChecked((curState) => !curState);
  };

  function onDialogOpenChangeHandler(open: boolean) {
    if (!open) {
      setAddressDialogContent(undefined);
    }
  }

  const mailingCountryChangeHandler = (event: React.SyntheticEvent<HTMLSelectElement>) => {
    setSelectedMailingCountry(event.currentTarget.value);
  };

  const countries = useMemo<InputOptionProps[]>(() => {
    return countryList.map(({ id, name }) => ({ children: name, value: id }));
  }, [countryList]);

  // populate mailing region/province/state list with selected country or current address country
  const mailingRegions = useMemo<InputOptionProps[]>(() => mailingCountryRegions.map(({ id, name }) => ({ children: name, value: id })), [mailingCountryRegions]);

  const dummyOption: InputOptionProps = {
    children: t(($) => $.address.addressField.selectOne),
    value: '',
  };

  const isPostalCodeRequired = [CANADA_COUNTRY_ID, USA_COUNTRY_ID].includes(selectedMailingCountry);

  let postalCodeHelpMessage: string | undefined;
  switch (selectedMailingCountry) {
    case CANADA_COUNTRY_ID: {
      postalCodeHelpMessage = t(($) => $.address.addressField.postalCodeHelp);
      break;
    }
    case USA_COUNTRY_ID: {
      postalCodeHelpMessage = t(($) => $.address.addressField.postalCodeHelpUs);
      break;
    }
    default: {
      postalCodeHelpMessage = undefined;
      break;
    }
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.address.mailingAddress.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <p className="mb-4 italic">{t(($) => $.optionalLabel, { ns: 'application' })}</p>
        <ErrorSummaryProvider actionData={fetcher.data}>
          <ErrorSummary />
          <fetcher.Form method="post" noValidate>
            <CsrfTokenInput />
            <fieldset className="mb-6">
              <div className="space-y-6">
                <InputSanitizeField
                  id="mailingAddress"
                  name="address"
                  className="w-full"
                  label={t(($) => $.address.addressField.address)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.address.addressField.addressHelp)}
                  helpMessagePrimaryClassName="text-black"
                  autoComplete="address-line1"
                  defaultValue={defaultState.address}
                  errorMessage={errors?.address}
                  required
                />
                <InputSanitizeField
                  id="mailing-apartment"
                  name="apartment"
                  className="w-full"
                  label={t(($) => $.address.addressField.apartment)}
                  maxLength={100}
                  helpMessagePrimary={t(($) => $.address.addressField.apartmentHelp)}
                  helpMessagePrimaryClassName="text-black"
                  autoComplete="address-line2"
                  defaultValue=""
                  errorMessage={errors?.apartment}
                />
                <InputSanitizeField id="mailing-city" name="city" className="w-full" label={t(($) => $.address.addressField.city)} maxLength={100} autoComplete="address-level2" defaultValue={defaultState.city} errorMessage={errors?.city} required />
                <InputSanitizeField
                  id="mailing-postal-code"
                  name="postalZipCode"
                  className="w-full sm:w-1/2"
                  label={isPostalCodeRequired ? t(($) => $.address.addressField.postalCode) : t(($) => $.address.addressField.postalCodeOptional)}
                  maxLength={100}
                  autoComplete="postal-code"
                  defaultValue={defaultState.postalCode}
                  errorMessage={errors?.postalZipCode}
                  required={isPostalCodeRequired}
                  helpMessagePrimary={postalCodeHelpMessage}
                  helpMessagePrimaryClassName="text-black"
                />
                {mailingRegions.length > 0 && (
                  <InputSelect
                    id="mailing-province"
                    name="provinceStateId"
                    className="w-full sm:w-1/2"
                    label={t(($) => $.address.addressField.province)}
                    defaultValue={defaultState.province}
                    errorMessage={errors?.provinceStateId}
                    options={[dummyOption, ...mailingRegions]}
                    required
                  />
                )}
                <InputSelect
                  id="mailing-country"
                  name="countryId"
                  className="w-full sm:w-1/2"
                  label={t(($) => $.address.addressField.country)}
                  autoComplete="country"
                  defaultValue={defaultState.country}
                  errorMessage={errors?.countryId}
                  options={countries}
                  onChange={mailingCountryChangeHandler}
                  required
                />
                <InputCheckbox id="sync-addresses" name="syncAddresses" value="true" checked={copyAddressChecked} onChange={checkHandler}>
                  {t(($) => $.address.homeAddress.useMailingAddress)}
                </InputCheckbox>
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
                    data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Continue - Mailing address click"
                  >
                    {copyAddressChecked ? t(($) => $.address.saveBtn) : t(($) => $.address.continue)}
                  </LoadingButton>
                </DialogTrigger>
                {!isSubmitting && addressDialogContent && (
                  <>
                    {addressDialogContent.status === 'address-suggestion' && (
                      <AddressSuggestionDialogContent enteredAddress={addressDialogContent.enteredAddress} suggestedAddress={addressDialogContent.suggestedAddress} syncAddresses={copyAddressChecked} formAction={FORM_ACTION.useSelectedAddress} />
                    )}
                    {addressDialogContent.status === 'address-invalid' && (
                      <AddressInvalidDialogContent addressContext="mailingAddress" invalidAddress={addressDialogContent.invalidAddress} syncAddresses={copyAddressChecked} formAction={FORM_ACTION.useInvalidAddress} />
                    )}
                  </>
                )}
              </Dialog>
              <ButtonLink
                id="back-button"
                variant="secondary"
                routeId={getRouteFromApplicationFlow(applicationFlow)}
                params={params}
                disabled={isSubmitting}
                data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Mailing address click"
              >
                {t(($) => $.address.back)}
              </ButtonLink>
            </div>
          </fetcher.Form>
        </ErrorSummaryProvider>
      </div>
    </>
  );
}
