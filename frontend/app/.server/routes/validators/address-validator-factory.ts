import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { AddressValidator, AddressValidatorErrorMessages } from '~/.server/routes/validators/address-validator';
import { DefaultAddressValidator } from '~/.server/routes/validators/address-validator';

/**
 * Interface for creating address validators.
 */
export interface AddressValidatorFactory {
  /**
   * Creates a new address validator.
   * @param errorMessages - The error messages to use.
   * @returns A new address validator.
   */
  createAddressValidator(errorMessages: AddressValidatorErrorMessages): AddressValidator;
}

@injectable()
/** Default implementation of the AddressValidatorFactory interface. */
export class DefaultAddressValidatorFactory {
  private readonly serverConfig: ServerConfig;

  constructor(@inject(TYPES.ServerConfig) serverConfig: ServerConfig) {
    this.serverConfig = serverConfig;
  }

  createAddressValidator(errorMessages: AddressValidatorErrorMessages): AddressValidator {
    return new DefaultAddressValidator(errorMessages, this.serverConfig);
  }
}
