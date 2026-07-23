import type { Address, AddressValidatorErrorMessages, AddressValidatorFactory } from '~/.server/routes/validators/';
import type { InvalidResult, ValidResult } from '~/.server/routes/validators/types-validator';
import { getFixedT } from '~/.server/utils/locale-utils';

/**
 * Interface for a mailing address validator.
 */
export interface MailingAddressValidator {
  /**
   * Validates a mailing address.
   * @param data The address data to validate.
   * @returns A promise that resolves to either a valid or invalid result.
   */
  validateMailingAddress(data: Partial<Address>): Promise<InvalidResult<Address> | ValidResult<Address>>;
}

export class DefaultMailingAddressValidator implements MailingAddressValidator {
  private readonly locale: AppLocale;
  private readonly addressValidatorFactory: AddressValidatorFactory;

  constructor(locale: AppLocale, addressValidatorFactory: AddressValidatorFactory) {
    this.locale = locale;
    this.addressValidatorFactory = addressValidatorFactory;
  }

  async validateMailingAddress(data: Partial<Address>): Promise<InvalidResult<Address> | ValidResult<Address>> {
    const errorMessages = await this.buildMailingAddressSchemaErrorMessages();
    const addressValidator = this.addressValidatorFactory.createAddressValidator(errorMessages);
    return addressValidator.validateAddress(data);
  }

  private async buildMailingAddressSchemaErrorMessages(): Promise<AddressValidatorErrorMessages> {
    const t = await getFixedT(this.locale, 'common');
    return {
      address: {
        invalidCharacters: t(($) => $.errorMessage.mailing.charactersValid),
        required: t(($) => $.errorMessage.mailing.addressRequired),
      },
      apartment: {
        invalidCharacters: t(($) => $.errorMessage.mailing.charactersValid),
      },
      city: {
        required: t(($) => $.errorMessage.mailing.cityRequired),
        invalidCharacters: t(($) => $.errorMessage.mailing.charactersValid),
      },
      country: {
        required: t(($) => $.errorMessage.mailing.countryRequired),
      },
      provinceState: {
        required: t(($) => $.errorMessage.mailing.provinceStateRequired),
      },
      postalZipCode: {
        invalidCharacters: t(($) => $.errorMessage.mailing.charactersValid),
        invalidPostalCode: t(($) => $.errorMessage.mailing.postalZipCodeValid),
        invalidPostalCodeForProvince: t(($) => $.errorMessage.mailing.invalidPostalZipCodeForProvince),
        invalidPostalZipCodeForCountry: t(($) => $.errorMessage.mailing.invalidPostalZipCodeForCountry),
        invalidZipCode: t(($) => $.errorMessage.mailing.zipCodeValid),
        required: t(($) => $.errorMessage.mailing.postalZipCodeRequired),
      },
    };
  }
}
