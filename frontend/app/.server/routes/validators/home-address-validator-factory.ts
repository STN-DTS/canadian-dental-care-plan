import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import type { AddressValidatorFactory } from '~/.server/routes/validators/';
import { DefaultHomeAddressValidator } from '~/.server/routes/validators/home-address-validator';
import type { HomeAddressValidator } from '~/.server/routes/validators/home-address-validator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';

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
    this.createHomeAddressValidator = createMemoized(this.createHomeAddressValidator, { maxSize: 1 });

    type MemoizedCreateHomeAddressValidator = MemoizedFunction<typeof this.createHomeAddressValidator>;
    (this.createHomeAddressValidator as MemoizedCreateHomeAddressValidator).cache.on('add', () => {
      this.log.debug('Home address validator cache entry created');
    });

    this.log.debug('DefaultHomeAddressValidatorFactory initiated.');
  }

  /**
   * Memoizes the creation of home address validators to reduce the number of times i18next files are read.
   * Each locale will have its own memoized validator.
   */
  @Traced()
  createHomeAddressValidator(locale: AppLocale): HomeAddressValidator {
    return new DefaultHomeAddressValidator(locale, this.addressValidatorFactory);
  }
}
