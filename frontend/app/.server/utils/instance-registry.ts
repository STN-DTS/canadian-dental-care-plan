/**
 * This module provides a utility for managing singleton instances.
 * It allows for the creation and retrieval of singleton objects, ensuring
 * that only one instance of a particular object exists throughout the
 * application's lifecycle. The module uses a global registry to store
 * and retrieve these instances, and it supports the use of factory
 * functions for creating instances on demand.
 */
import type { RouteObject, ServerBuild } from 'react-router';

import type { Logger } from 'winston';

import type { RedisClient } from '~/.server/data';
import type { LoggingConfig } from '~/.server/logging/logging-config';
import type { ServerEnv } from '~/.server/utils/env.utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import type { ClientEnv } from '~/utils/env-utils';

/**
 * Maps instance names to their corresponding types for singleton management.
 * Each property key represents a unique instance name, and its value is the type
 * of the singleton instance associated with that name.
 */
interface InstanceTypeMap {
  clientEnv: ClientEnv;
  loggingConfig: LoggingConfig;
  redisClient: RedisClient;
  routes: readonly RouteObject[];
  serverBuild: ServerBuild;
  serverRoute: ServerBuild;
  serverEnv: ServerEnv;
  winstonLogger: Logger;
}

/**
 * Represents the valid keys of InstanceTypeMap.
 * Used to constrain the allowed instance names for singleton retrieval and registration.
 */
type InstanceName = keyof InstanceTypeMap;

function instanceRegistry(): Map<InstanceName, unknown> {
  /* eslint-disable-next-line @typescript-eslint/no-unnecessary-condition */
  globalThis.__instanceRegistry ??= new Map<InstanceName, unknown>();
  return globalThis.__instanceRegistry;
}

/**
 * Retrieves a singleton instance by name. If the instance does not exist, it is created using the provided factory function.
 *
 * @param instanceName - The unique name of the singleton instance to retrieve.
 * @param factory - Optional. A function to create the instance if it does not exist.
 * @returns The singleton instance associated with the given name.
 * @throws {AppError} If the instance is not found and no factory function is provided.
 *
 * Example usage:
 *   const env = singleton('serverEnv', () => loadServerEnv());
 */
export function singleton<N extends InstanceName, T extends InstanceTypeMap[N]>(instanceName: N, factory?: () => T): T {
  const registry = instanceRegistry();

  if (!registry.has(instanceName)) {
    if (!factory) {
      throw new AppError(`Instance [${instanceName}] not found and factory not provided`, ErrorCodes.NO_FACTORY_PROVIDED);
    }

    registry.set(instanceName, factory());
  }

  return registry.get(instanceName) as T;
}

/**
 * Checks if a singleton instance exists in the registry.
 *
 * @param instanceName - The unique name of the singleton instance to check.
 * @returns True if the instance exists, false otherwise.
 */
export function hasSingleton<N extends InstanceName>(instanceName: N): boolean {
  const registry = instanceRegistry();
  return registry.has(instanceName);
}

/**
 * Registers a singleton instance in the registry. If an instance with the same name already exists,
 * it will be overwritten.
 *
 * @param instanceName - The unique name of the singleton instance to register.
 * @param instance - The singleton instance to register.
 * @returns The registered singleton instance.
 */
export function setSingleton<N extends InstanceName, T extends InstanceTypeMap[N]>(instanceName: N, instance: T): T {
  const registry = instanceRegistry();
  registry.set(instanceName, instance);
  return instance;
}

/**
 * Deletes a singleton instance from the registry.
 *
 * @param instanceName - The unique name of the singleton instance to delete.
 */
export function deleteSingleton<N extends InstanceName>(instanceName: N): void {
  const registry = instanceRegistry();
  registry.delete(instanceName);
}
