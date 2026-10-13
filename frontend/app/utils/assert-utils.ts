/**
 * Utility function to assert that a value is defined (not null or undefined).
 * If the value is not defined, an error is thrown with the provided message.
 *
 * @param value - The value to check for being defined.
 * @param message - The error message to throw if the value is not defined.
 * @returns The original value if it is defined.
 * @throws Error if the value is null or undefined.
 */
export function expectDefined<T>(value: T | null | undefined, message: string): T {
  if (value === null || value === undefined) {
    throw new Error(message);
  }

  return value as T;
}
