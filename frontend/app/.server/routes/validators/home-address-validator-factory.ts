import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { AddressValidatorFactory } from '~/.server/routes/validators/';
import { DefaultHomeAddressValidator } from '~/.server/routes/validators/home-address-validator';
import type { HomeAddressValidator } from '~/.server/routes/validators/home-address-validator';

/**
 * Factory interface for creating home address validators.
 */
export interface HomeAddressValidatorFactory {
  /**
   * Creates a new home address validator for the given locale.
   * @param locale The locale to use for validation.
   * @returns A new home address validator.
   */
  createHomeAddressValidator(locale: AppLocale): HomeAddressValidator;
}

@injectable()
export class DefaultHomeAddressValidatorFactory implements HomeAddressValidatorFactory {
  private readonly log: Logger;
  private readonly addressValidatorFactory: AddressValidatorFactory;

  constructor(@inject(TYPES.AddressValidatorFactory) addressValidatorFactory: AddressValidatorFactory) {
    this.log = createLogger('DefaultHomeAddressValidatorFactory');
    this.addressValidatorFactory = addressValidatorFactory;
    this.init();
  }

  private init(): void {
    this.createHomeAddressValidator = memoize(this.createHomeAddressValidator);

    type MemoizedCreateHomeAddressValidator = Memoized<typeof this.createHomeAddressValidator, Options<typeof this.createHomeAddressValidator>>;
    (this.createHomeAddressValidator as MemoizedCreateHomeAddressValidator).cache.on('add', ({ key }) => {
      this.log.info('Creating new createHomeAddressValidator memo; cache.key: %s', key);
    });

    this.log.debug('DefaultHomeAddressValidatorFactory initiated.');
  }

  /**
   * Memoizes the creation of home address validators to reduce the number of times i18next files are read.
   * Each locale will have its own memoized validator.
   */
  createHomeAddressValidator(locale: AppLocale): HomeAddressValidator {
    return new DefaultHomeAddressValidator(locale, this.addressValidatorFactory);
  }
}
