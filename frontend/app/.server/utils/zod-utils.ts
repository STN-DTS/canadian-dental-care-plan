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
