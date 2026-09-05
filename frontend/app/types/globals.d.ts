/**
 * Declares application-wide global types and runtime holders.
 *
 * Type-only imports make this file an external module, allowing its
 * declarations to be exposed globally through `declare global`.
 */
import type { RouteModules } from 'react-router';

import type { ClientEnv } from '~/.server/utils/env-utils';
import type { InstanceName } from '~/.server/utils/instance-registry';
import type { APP_LOCALES } from '~/utils/locale-utils';

/**
 * Application-scoped global types.
 */
declare global {
  /**
   * React Router adds the route modules to global
   * scope, but doesn't declare them anywhere.
   */
  var __reactRouterRouteModules: RouteModules;

  /**
   * A holder for any application-scoped singletons.
   */
  var __instanceRegistry: Map<InstanceName, unknown>;

  /**
   * A union type representing the possible values for the application locale.
   * This type is derived from the elements of the `APP_LOCALES` array.
   */
  type AppLocale = (typeof APP_LOCALES)[number];

  /**
   * Add the public environment variables to the global window type.
   */
  interface Window {
    env: ClientEnv;
  }

  /**
   * Extract from `T` those types that are assignable to `U`, where `U` must exist in `T`.
   *
   * Similar to `Extract` but requires the extraction list to be composed of valid members of `T`.
   *
   * @see https://github.com/pelotom/type-zoo?tab=readme-ov-file#extractstrictt-u-extends-t
   */
  type ExtractStrict<T, U extends T> = T extends U ? T : never;

  /**
   * Drop keys `K` from `T`, where `K` must exist in `T`.
   *
   * @see https://github.com/pelotom/type-zoo?tab=readme-ov-file#omitstrictt-k-extends-keyof-t
   */
  type OmitStrict<T, K extends keyof T> = T extends any ? Pick<T, Exclude<keyof T, K>> : never;

  /**
   * Compile-time-only marker used to distinguish otherwise compatible types.
   */
  const brand: unique symbol;

  /**
   * Adds a compile-time identity to a value without changing its runtime type.
   *
   * Values with the same underlying type but different names are not
   * interchangeable.
   */
  type Brand<Value, Name extends string> = Value & {
    readonly [brand]: Name;
  };
}
