import type { Container } from 'inversify';

import type { ServiceIdentifier } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * AppContainerProvider interface provides methods for accessing services within an Inversify IoC container.
 */
export interface AppContainerProvider {
  /**
   * Tries to locate a service in the container without throwing an error if not found.
   * @param serviceIdentifier - The service identifier for the requested service.
   * @returns The service instance if found; otherwise, `undefined`.
   */
  find<T>(serviceIdentifier: ServiceIdentifier<T>): T | undefined;

  /**
   * Retrieves all instances of a service from the container without throwing an error if the service is not found.
   * @param serviceIdentifier - The service identifier for the requested service.
   * @returns An array of instances of the requested service.
   */
  findAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[];

  /**
   * Retrieves a service from the container. Throws an error if the service is not found.
   * @param serviceIdentifier - The service identifier for the requested service.
   * @returns The instance of the requested service.
   */
  get<T>(serviceIdentifier: ServiceIdentifier<T>): T;

  /**
   * Retrieves all instances of a service from the container. Throws an error if the service is not found.
   * @param serviceIdentifier - The service identifier for the requested service.
   * @returns An array of instances of the requested service.
   */
  getAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[];
}

export class DefaultAppContainerProvider implements AppContainerProvider {
  private readonly container: Container;
  private readonly log: Logger;

  constructor(container: Container) {
    this.container = container;
    this.log = createLogger('DefaultAppContainerProvider');
  }

  find<T>(serviceIdentifier: ServiceIdentifier<T>): T | undefined {
    this.log.trace('Finding service for service identifier: %s', serviceIdentifier);
    return this.container.get(serviceIdentifier, { optional: true });
  }

  findAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[] {
    this.log.trace('Finding service for service identifier: %s', serviceIdentifier);
    return this.container.getAll(serviceIdentifier, { optional: true });
  }

  get<T>(serviceIdentifier: ServiceIdentifier<T>): T {
    this.log.trace('Get service for service identifier: %s', serviceIdentifier);
    return this.container.get(serviceIdentifier);
  }

  getAll<T>(serviceIdentifier: ServiceIdentifier<T>): T[] {
    this.log.trace('Getting all services for service identifier: %s', serviceIdentifier);
    return this.container.getAll(serviceIdentifier);
  }
}
