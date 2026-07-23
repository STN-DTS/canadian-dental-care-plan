import validator from 'validator';
import * as z from 'zod';

import type { ServerConfig } from '~/.server/configs';
import type { InvalidResult, ValidResult } from '~/.server/routes/validators/types-validator';
import { formatPostalCode, isValidCanadianPostalCode, isValidPostalCode } from '~/.server/utils/postal-zip-code-utils';
import { transformFlattenedError } from '~/.server/utils/zod-utils';
import { isAllValidInputCharacters } from '~/utils/string-utils';

/**
 * Interface for Address input data.
 */
export interface Address {
  /** Street address or specific location detail. */
  address: string;
  /** Unit, suite, or apartment number (optional). */
  apartment?: string;
  /** Name of the city associated with the address. */
  city: string;
  /** Identifier for the country associated with the address. */
  countryId: string;
  /** Postal or ZIP code for the address. */
  postalZipCode?: string;
  /** Identifier for the province or state associated with the address. */
  provinceStateId?: string;
}

/**
 * Error messages configuration for AddressValidator.
 */
export interface AddressValidatorErrorMessages {
  address: {
    invalidCharacters: string;
    required: string;
  };
  apartment: {
    invalidCharacters: string;
  };
  city: {
    invalidCharacters: string;
    required: string;
  };
  country: {
    required: string;
  };
  postalZipCode: {
    invalidCharacters: string;
    invalidPostalCode: string;
    invalidPostalCodeForProvince: string;
    invalidPostalZipCodeForCountry: string;
    invalidZipCode: string;
    required: string;
  };
  provinceState: {
    required: string;
  };
}

export interface AddressValidator {
  validateAddress(data: Partial<Address>): InvalidResult<Address> | ValidResult<Address>;
}

export class DefaultAddressValidator {
  private readonly errorMessages: AddressValidatorErrorMessages;
  private readonly serverConfig: Pick<ServerConfig, 'CANADA_COUNTRY_ID' | 'USA_COUNTRY_ID'>;

  constructor(errorMessages: AddressValidatorErrorMessages, serverConfig: Pick<ServerConfig, 'CANADA_COUNTRY_ID' | 'USA_COUNTRY_ID'>) {
    this.errorMessages = errorMessages;
    this.serverConfig = serverConfig;
  }

  /**
   * Validates address data. Returns validation success and either parsed data or errors.
   * @param data - Partial address input data to validate.
   */
  validateAddress(data: Partial<Address>): InvalidResult<Address> | ValidResult<Address> {
    const addressSchema = this.buildAddressSchema();
    const parsedDataResult = addressSchema.safeParse(data);

    if (parsedDataResult.success) {
      return { success: true, data: parsedDataResult.data };
    }
    return {
      success: false,
      errors: transformFlattenedError(z.flattenError(parsedDataResult.error)),
    };
  }

  /**
   * Returns a Zod schema for validating Address input data.
   * This schema validates required fields and specific country-based requirements.
   */
  private buildAddressSchema(): z.ZodType<Address> {
    const { CANADA_COUNTRY_ID, USA_COUNTRY_ID } = this.serverConfig;

    return z
      .object({
        address: z
          .string({
            error: (issue) => (issue.input === undefined ? this.errorMessages.address.required : undefined),
          })
          .trim()
          .min(1, this.errorMessages.address.required)
          .max(100)
          .refine(isAllValidInputCharacters, this.errorMessages.address.invalidCharacters),
        apartment: z.string().trim().max(100).refine(isAllValidInputCharacters, this.errorMessages.address.invalidCharacters).optional(),
        countryId: z
          .string({
            error: (issue) => (issue.input === undefined ? this.errorMessages.country.required : undefined),
          })
          .trim()
          .min(1, this.errorMessages.country.required),
        provinceStateId: z
          .string({
            error: (issue) => (issue.input === undefined ? this.errorMessages.provinceState.required : undefined),
          })
          .trim()
          .min(1, this.errorMessages.provinceState.required)
          .optional(),
        city: z
          .string({
            error: (issue) => (issue.input === undefined ? this.errorMessages.city.required : undefined),
          })
          .trim()
          .min(1, this.errorMessages.city.required)
          .max(100)
          .refine(isAllValidInputCharacters, this.errorMessages.city.invalidCharacters),
        postalZipCode: z.string().trim().max(100).refine(isAllValidInputCharacters, this.errorMessages.postalZipCode.invalidCharacters).optional(),
      })

      .superRefine((val, ctx) => {
        const { countryId: country, provinceStateId: provinceState, postalZipCode } = val;
        const isCanada = country === CANADA_COUNTRY_ID;
        const isUSA = country === USA_COUNTRY_ID;

        // Province/State validation for Canada and USA
        if ((isCanada || isUSA) && (!provinceState || validator.isEmpty(provinceState))) {
          ctx.addIssue({
            code: 'custom',
            message: this.errorMessages.provinceState.required,
            path: ['provinceStateId'],
          });
        }

        // Postal/Zip Code validation for Canada and USA
        if ((isCanada || isUSA) && (!postalZipCode || validator.isEmpty(postalZipCode))) {
          ctx.addIssue({
            code: 'custom',
            message: this.errorMessages.postalZipCode.required,
            path: ['postalZipCode'],
          });
        } else if (isUSA && postalZipCode && !isValidPostalCode(country, postalZipCode)) {
          ctx.addIssue({
            code: 'custom',
            message: this.errorMessages.postalZipCode.invalidZipCode,
            path: ['postalZipCode'],
          });
        } else if (isCanada && postalZipCode) {
          if (!isValidPostalCode(CANADA_COUNTRY_ID, postalZipCode)) {
            ctx.addIssue({
              code: 'custom',
              message: this.errorMessages.postalZipCode.invalidPostalCode,
              path: ['postalZipCode'],
            });
          } else if (provinceState && !isValidCanadianPostalCode(provinceState, postalZipCode)) {
            ctx.addIssue({
              code: 'custom',
              message: this.errorMessages.postalZipCode.invalidPostalCodeForProvince,
              path: ['postalZipCode'],
            });
          }
        }

        // Ensure postal code does not match Canadian format for non-Canadian addresses
        if (!isCanada && postalZipCode && isValidPostalCode(CANADA_COUNTRY_ID, postalZipCode)) {
          ctx.addIssue({
            code: 'custom',
            message: this.errorMessages.postalZipCode.invalidPostalZipCodeForCountry,
            path: ['countryId'],
          });
        }
      })
      .transform((val) => ({
        ...val,
        postalZipCode: val.countryId && val.postalZipCode ? formatPostalCode(val.countryId, val.postalZipCode) : val.postalZipCode,
      }));
  }
}
