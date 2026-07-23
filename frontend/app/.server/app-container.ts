/**
 * This module bootstraps the application by creating an Inversion of Control (IoC) container.
 * It uses InversifyJS to initialize and manage dependency injection across various modules.
 *
 * The container is a singleton, ensuring that all parts of the application share
 * the same instances of dependencies.
 *
 * A logger middleware is included to provide visibility into dependency resolution,
 * which can be useful for debugging.
 */
import { Container } from 'inversify';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { DefaultAppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import {
  createAuthContainerModule,
  createConfigsContainerModule,
  createHealthContainerModule,
  createMappersContainerModule,
  createRepositoriesContainerModule,
  createRoutesContainerModule,
  createRoutesValidatorsContainerModule,
  createServicesContainerModule,
  createWebContainerModule,
} from '~/.server/container-modules';
import { createLogger } from '~/.server/logging';

let appContainerProviderInstance: AppContainerProvider | undefined;

/**
 * Returns the AppContainerProvider singleton instance.
 */
export function appContainer() {
  return (appContainerProviderInstance ??= new DefaultAppContainerProvider(createContainer()));
}

/**
 * Creates and configures a new IoC container instance.
 *
 * This function initializes the container by loading the necessary modules
 * in the correct order to ensure dependencies are properly injected.
 */
function createContainer() {
  const log = createLogger('container/createContainer');

  const container = new Container({ defaultScope: 'Singleton' });
  log.info('Creating IoC container');

  // Load configurations first to ensure `ServerConfig` is available
  // for conditional service bindings in other modules.
  container.load(createConfigsContainerModule());
  const serverConfig = container.get(TYPES.ServerConfig);

  // Load other container modules
  container.load(
    createAuthContainerModule(),
    createHealthContainerModule(serverConfig),
    createMappersContainerModule(),
    createRepositoriesContainerModule(serverConfig),
    createRoutesContainerModule(),
    createRoutesValidatorsContainerModule(),
    createServicesContainerModule(serverConfig),
    createWebContainerModule(),
  );

  log.info('IoC container created successfully');

  return container;
}
