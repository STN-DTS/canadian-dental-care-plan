import { flatKeys, set } from 'moderndash';
import assert from 'node:assert';

import type { ServiceIdentifier, ServiceTypesMap } from '~/.server/constants';

/**
 * Generates a unique `ServiceIdentifier` for dependency injection, using a string identifier.
 * The identifier is globally unique, thanks to the use of `Symbol.for`.
 * If no identifier is provided, the default value `'unknown'` is used.
 *
 * @param identifier - The name for the identifier. Defaults to `'unknown'` if not provided.
 * @returns A unique `ServiceIdentifier` symbol for the specified type.
 * @template T - The type associated with the service identifier.
 * @example
 * ```typescript
 * const applicantServiceId = serviceIdentifier<ApplicantService>('ApplicantService');
 * const defaultServiceId = serviceIdentifier<DefaultService>(); // Uses 'unknown' as identifier
 * ```
 */
export function serviceIdentifier<T>(identifier: string = 'unknown'): ServiceIdentifier<T> {
  return Symbol.for(identifier) as unknown as ServiceIdentifier<T>;
}

/**
 * Recursively assigns service identifiers to each key path in the provided types object.
 * This function traverses the nested structure of `types`, converting each key path into
 * a service identifier using the `serviceIdentifier` function. The result is a new object
 * where each key corresponds to a `ServiceIdentifier` symbol that uniquely identifies a service.
 *
 * @param {T} types - The original types object to be transformed.
 * @returns {T} A new object with transformed service identifiers, where each key path is replaced
 *              with a unique `ServiceIdentifier` symbol.
 * @template T - The type of the input `types` object, which can contain nested structures.
 * @example
 * const types = {
 *   UserService: {},
 *   ProductService: {},
 *   web: {
 *     validators: {
 *       CsrfTokenValidator: {},
 *     },
 *   },
 * };
 *
 * const serviceIdentifiers = assignServiceIdentifiers(types);
 *
 * console.log(serviceIdentifiers.UserService); // Symbol(UserService)
 * console.log(serviceIdentifiers.web.validators.CsrfTokenValidator); // Symbol(web.validators.CsrfTokenValidator)
 * ```
 */
export function assignServiceIdentifiers<T extends ServiceTypesMap>(types: T): T {
  const newTypes = { ...types }; // Shallow copy of the original types structure.
  const flattenedKeys = flatKeys(types); // Get all nested key paths as an object.

  // Map each key of the flattenedKeys object to a service identifier.
  for (const identifierKey of Object.keys(flattenedKeys)) {
    assert.ok(typeof flattenedKeys[identifierKey as keyof typeof flattenedKeys] === 'symbol', `Expected "${identifierKey}" to be a symbol`);
    set(newTypes, identifierKey, serviceIdentifier(identifierKey));
  }

  return newTypes;
}
