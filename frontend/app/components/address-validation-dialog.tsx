import { useId, useState } from 'react';
import type { SyntheticEvent } from 'react';

import { useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans, useTranslation } from 'react-i18next';

import { Address } from '~/components/address';
import { Button } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '~/components/dialog';
import { InputCheckbox } from '~/components/input-checkbox';
import { InputRadios } from '~/components/input-radios';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';

export interface CanadianAddress {
  address: string;
  city: string;
  country: string;
  countryId: string;
  postalZipCode: string;
  provinceState: string;
  provinceStateId: string;
}

export interface AddressSuggestionResponse {
  enteredAddress: CanadianAddress;
  status: 'address-suggestion';
  suggestedAddress: CanadianAddress;
}

export interface AddressInvalidResponse {
  invalidAddress: CanadianAddress;
  status: 'address-invalid';
}

export type AddressResponse = AddressSuggestionResponse | AddressInvalidResponse;

interface AddressSuggestionDialogContentProps {
  enteredAddress: CanadianAddress;
  suggestedAddress: CanadianAddress;
  formAction: string;
  syncAddresses?: boolean;
}

export function AddressSuggestionDialogContent({ enteredAddress, suggestedAddress, formAction, syncAddresses = false }: AddressSuggestionDialogContentProps) {
  const { t } = useTranslation('common');
  const fetcher = useFetcher();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const enteredAddressOptionValue = 'entered-address';
  const suggestedAddressOptionValue = 'suggested-address';
  type AddressSelectionOption = typeof enteredAddressOptionValue | typeof suggestedAddressOptionValue;
  const [selectedAddressSuggestionOption, setSelectedAddressSuggestionOption] = useState<AddressSelectionOption>(suggestedAddressOptionValue);

  async function onSubmitHandler(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Get the clicked button's value and append it to the FormData object
    const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
    invariant(submitter, 'Expected submitter to be defined');
    formData.set(submitter.name, submitter.value);

    // Append selected address suggestion to form data
    const selectedAddressSuggestion = selectedAddressSuggestionOption === enteredAddressOptionValue ? enteredAddress : suggestedAddress;
    formData.set('address', selectedAddressSuggestion.address);
    formData.set('city', selectedAddressSuggestion.city);
    formData.set('countryId', selectedAddressSuggestion.countryId);
    formData.set('postalZipCode', selectedAddressSuggestion.postalZipCode);
    formData.set('provinceStateId', selectedAddressSuggestion.provinceStateId);
    if (syncAddresses) {
      formData.set('syncAddresses', 'true');
    }

    await fetcher.submit(formData, { method: 'POST' });
  }

  const dialogDescriptionId = useId();

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-lg text-amber-600" />
          <span>{t(($) => $.dialog.addressSuggestion.header)}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-6">
        <p id={dialogDescriptionId}>
          <Trans ns="common" i18nKey={($) => $.dialog.addressSuggestion.description} />
        </p>
        <InputRadios
          id="addressSelection"
          name="addressSelection"
          legend={t(($) => $.dialog.addressSuggestion.addressSelectionLegend)}
          outerAriaDescribedById={dialogDescriptionId}
          options={[
            {
              value: enteredAddressOptionValue,
              children: (
                <>
                  <p className="mb-2">
                    <strong>{t(($) => $.dialog.addressSuggestion.enteredAddressOption)}</strong>
                  </p>
                  <Address address={enteredAddress} />
                </>
              ),
            },
            {
              value: suggestedAddressOptionValue,
              children: (
                <>
                  <p className="mb-2">
                    <strong>{t(($) => $.dialog.addressSuggestion.suggestedAddressOption)}</strong>
                  </p>
                  <Address address={suggestedAddress} />
                </>
              ),
            },
          ].map((option) => ({
            value: option.value,
            children: option.children,
            onChange: (e) => {
              setSelectedAddressSuggestionOption(e.target.value as AddressSelectionOption);
            },
            checked: option.value === selectedAddressSuggestionOption,
          }))}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button id="dialog.corrected-address-close-button" disabled={isSubmitting} variant="secondary" size="sm" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form:Dialog Back - Address Suggestion click">
            {t(($) => $.dialog.addressSuggestion.cancelButton)}
          </Button>
        </DialogClose>
        <fetcher.Form method="post" noValidate onSubmit={onSubmitHandler}>
          <CsrfTokenInput />
          <LoadingButton
            name="_action"
            value={formAction}
            type="submit"
            id="dialog.corrected-address-use-selected-address-button"
            loading={isSubmitting}
            variant="primary"
            size="sm"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form:Dialog Use Selected Address - Address Suggestion click"
          >
            {t(($) => $.dialog.addressSuggestion.useSelectedAddressButton)}
          </LoadingButton>
        </fetcher.Form>
      </DialogFooter>
    </DialogContent>
  );
}

interface AddressInvalidDialogContentProps {
  invalidAddress: CanadianAddress;
  formAction: string;
  syncAddresses?: boolean;
  addressContext: 'homeAddress' | 'mailingAddress';
}

export function AddressInvalidDialogContent({ formAction, invalidAddress, syncAddresses = false, addressContext }: AddressInvalidDialogContentProps) {
  const { t } = useTranslation('common');
  const fetcher = useFetcher();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);
  const [isCheckboxChecked, setIsCheckboxChecked] = useState(false);

  async function onSubmitHandler(event: SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Get the clicked button's value and append it to the FormData object
    const submitter = event.nativeEvent.submitter as HTMLButtonElement | null;
    invariant(submitter, 'Expected submitter to be defined');
    formData.set(submitter.name, submitter.value);

    // Append selected address suggestion to form data
    formData.set('address', invalidAddress.address);
    formData.set('city', invalidAddress.city);
    formData.set('countryId', invalidAddress.countryId);
    formData.set('postalZipCode', invalidAddress.postalZipCode);
    formData.set('provinceStateId', invalidAddress.provinceStateId);
    if (syncAddresses) {
      formData.set('syncAddresses', 'true');
    }

    await fetcher.submit(formData, { method: 'POST' });
  }

  return (
    <DialogContent aria-describedby={undefined}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FontAwesomeIcon icon={faTriangleExclamation} className="text-lg text-amber-600" />
          <span>{t(($) => $.dialog.addressInvalid.header)}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="mb-6 space-y-6">
        <p>
          <Trans ns="common" i18nKey={($) => $.dialog.addressInvalid.description} />
        </p>
        <p>
          <Trans ns="common" i18nKey={($) => $.dialog.addressInvalid.important} />
        </p>
        <h3 className="font-lato text-xl font-bold">{t(($) => $.dialog.addressInvalid.context[addressContext])}</h3>
        <div className="space-y-2">
          <p>
            <strong>{t(($) => $.dialog.addressInvalid.enteredAddress)}</strong>
          </p>
          <Address address={invalidAddress} />
        </div>
        <InputCheckbox id="confirm-checkbox" name="confirm-checkbox" onChange={() => setIsCheckboxChecked((prev) => !prev)}>
          {t(($) => $.dialog.addressInvalid.checkbox)}
        </InputCheckbox>
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button id="dialog.address-invalid-close-button" variant="secondary" size="sm" data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form:Dialog Back - Address Invalid click">
            {t(($) => $.dialog.addressInvalid.closeButton)}
          </Button>
        </DialogClose>
        <fetcher.Form method="post" noValidate onSubmit={onSubmitHandler}>
          <CsrfTokenInput />
          <LoadingButton
            name="_action"
            value={formAction}
            type="submit"
            id="dialog.address-invalid-use-entered-address-button"
            loading={isSubmitting}
            disabled={!isCheckboxChecked}
            variant="primary"
            size="sm"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form:Dialog Use entered address - Address Invalid click"
          >
            {t(($) => $.dialog.addressInvalid.continueButton)}
          </LoadingButton>
        </fetcher.Form>
      </DialogFooter>
    </DialogContent>
  );
}
