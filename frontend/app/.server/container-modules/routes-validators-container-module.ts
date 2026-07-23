import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import { DefaultAddressValidatorFactory } from '~/.server/routes/validators';
import { DefaultHomeAddressValidatorFactory } from '~/.server/routes/validators/home-address-validator-factory';
import { DefaultMailingAddressValidatorFactory } from '~/.server/routes/validators/mailing-address-validator-factory';

/**
 * Defines the container module for routes validator bindings.
 */
export function createRoutesValidatorsContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.AddressValidatorFactory).to(DefaultAddressValidatorFactory);
    options.bind(TYPES.MailingAddressValidatorFactory).to(DefaultMailingAddressValidatorFactory);
    options.bind(TYPES.HomeAddressValidatorFactory).to(DefaultHomeAddressValidatorFactory);
  });
}
