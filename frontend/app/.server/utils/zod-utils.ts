import { Redacted } from 'effect';
import * as z from 'zod';

/**
 * Transforms a flattened error object by mapping each field to its first error message.
 *
 * @param flattenedError - An object containing `fieldErrors`, which is a record of field names to an array of error messages.
 * @returns An object where each field is mapped to its first error message, or `undefined` if no error message is present.
 *
 * @example
 * // Input:
 * // {
 * //   fieldErrors: {
 * //     name: ["Name is required", "Name is too short"],
 * //     age: ["Age must be a number"]
 * //   }
 * // }
 * // Output:
 * // {
 * //   name: "Name is required",
 * //   age: "Age must be a number"
 * // }
 *
 * const flattenedError = {
 *   fieldErrors: {
 *     name: ["Name is required", "Name is too short"],
 *     age: ["Age must be a number"]
 *   }
 * };
 * const result = transformFlattenedError(flattenedError);
 * console.log(result);
 * // Output: { name: "Name is required", age: "Age must be a number" }
 */
export function transformFlattenedError<T extends { fieldErrors: Record<string, string[]> }>(flattenedError: T): { [K in keyof T['fieldErrors']]: string | undefined } {
  const transformedEntries = Object.entries(flattenedError.fieldErrors).map(([key, value]) => [key, value[0]]);
  return Object.fromEntries(transformedEntries);
}

/**
 * Converts a raw string into an Effect Redacted value when parsing.
 *
 * Use as a field schema when parsed data should keep that field wrapped:
 * `parse`/`decode`: string -> Redacted<string>.
 * `encode`: Redacted<string> -> string.
 * Encoding exposes the original string; only do so when it needs to leave the app.
 */
export const stringToRedacted = z.codec(
  z.string(), // Raw representation (API / DB string)
  z.custom<Redacted.Redacted<string>>((val) => Redacted.isRedacted(val)), // Domain representation
  {
    decode: (rawString) => Redacted.make(rawString),
    encode: (redactedVal) => Redacted.value(redactedVal),
  },
);

/**
 * Reverses `stringToRedacted` for inputs that are already Redacted values.
 *
 * `parse`/`decode`: Redacted<string> -> string.
 * `encode`: string -> Redacted<string>.
 * Parsing this codec exposes the original string; it does not redact raw input.
 */
export const redactedString = z.invertCodec(stringToRedacted);
