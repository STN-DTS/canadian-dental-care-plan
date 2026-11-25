import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import type { AddressValidatorFactory } from '~/.server/routes/validators/';
import { DefaultMailingAddressValidator } from '~/.server/routes/validators/mailing-address-validator';
import type { MailingAddressValidator } from '~/.server/routes/validators/mailing-address-validator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';

/**
 * Factory interface for creating mailing address validators.
 */
export interface MailingAddressValidatorFactory {
  /**
   * Creates a new mailing address validator for the given locale.
   * @param locale The locale to use for validation.
   * @returns A new mailing address validator.
   */
  createMailingAddressValidator(locale: AppLocale): MailingAddressValidator;
}

@injectable()
export class DefaultMailingAddressValidatorFactory implements MailingAddressValidatorFactory {
  private readonly log: Logger;
  private readonly addressValidatorFactory: AddressValidatorFactory;

  constructor(@inject(TYPES.AddressValidatorFactory) addressValidatorFactory: AddressValidatorFactory) {
    this.log = createLogger('DefaultMailingAddressValidatorFactory');
    this.addressValidatorFactory = addressValidatorFactory;
    this.init();
  }

  private init(): void {
    this.createMailingAddressValidator = createMemoized(this.createMailingAddressValidator, { maxSize: 1 });

    type MemoizedCreateMailingAddressValidator = MemoizedFunction<typeof this.createMailingAddressValidator>;
    (this.createMailingAddressValidator as MemoizedCreateMailingAddressValidator).cache.on('add', () => {
      this.log.debug('Mailing address validator cache entry created');
    });

    this.log.debug('DefaultMailingAddressValidatorFactory initiated.');
  }

  /**
   * Memoizes the creation of mailing address validators to reduce the number of times i18next files are read.
   * Each locale will have its own memoized validator.
   */
  @Traced()
  createMailingAddressValidator(locale: AppLocale): MailingAddressValidator {
    return new DefaultMailingAddressValidator(locale, this.addressValidatorFactory);
  }
}
