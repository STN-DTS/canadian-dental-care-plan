import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import { DefaultCsrfTokenValidator, DefaultHCaptchaValidator, DefaultRaoidcSessionValidator } from '~/.server/web/validators';

/**
 * Defines the container module for web bindings.
 */
export function createWebContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.CsrfTokenValidator).to(DefaultCsrfTokenValidator);
    options.bind(TYPES.HCaptchaValidator).to(DefaultHCaptchaValidator);
    options.bind(TYPES.RaoidcSessionValidator).to(DefaultRaoidcSessionValidator);
  });
}
