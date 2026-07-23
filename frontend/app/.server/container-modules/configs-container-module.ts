import { ContainerModule } from 'inversify';

import { TYPES } from '~/.server/constants';
import { getEnv } from '~/.server/utils/env-utils';
import { getClientEnv } from '~/utils/env-utils';

/**
 * Defines the container module for configuration bindings.
 */
export function createConfigsContainerModule(): ContainerModule {
  return new ContainerModule((options) => {
    options.bind(TYPES.ClientConfig).toDynamicValue(() => getClientEnv());
    options.bind(TYPES.ServerConfig).toDynamicValue(() => getEnv());
  });
}
