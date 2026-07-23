import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import { DefaultProtectedApplicationStateResolver, DefaultPublicApplicationStateResolver } from '~/.server/routes/resolvers';
import { DefaultSecurityHandler } from '~/.server/routes/security';

/**
 * Defines the container module for route bindings.
 */
export function createRoutesContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.ProtectedApplicationStateResolver).to(DefaultProtectedApplicationStateResolver);
    options.bind(TYPES.PublicApplicationStateResolver).to(DefaultPublicApplicationStateResolver);
    options.bind(TYPES.SecurityHandler).to(DefaultSecurityHandler);
  });
}
