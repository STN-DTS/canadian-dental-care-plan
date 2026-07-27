import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import { DefaultHCaptchaValidator, DefaultRaoidcSessionValidator } from '~/.server/web/validators';

/**
 * Defines the container module for web bindings.
 */
export function createWebContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.HCaptchaValidator).to(DefaultHCaptchaValidator);
    options.bind(TYPES.RaoidcSessionValidator).to(DefaultRaoidcSessionValidator);
  });
}
