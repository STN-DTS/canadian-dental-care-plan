import * as z from 'zod';

/**
 * Zod schema for validating the structure of a UUID.
 * Enforces the standard UUID format (8-4-4-4-12 hexadecimal characters).
 * Note: This regex allows for any version and variant of UUID, including custom ones.
 */
const uuidSchema = z //
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'Invalid UUID format');

/**
 * Generates a unique identifier string.
 *
 * This function uses the Web Crypto API to generate a UUID, which provides a high degree of uniqueness and is suitable
 * for use as an identifier in various contexts.
 *
 * @returns A string representing the generated unique identifier.
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Validates if the provided string matches the expected ID format.
 *
 * @param id - The identifier string to validate.
 * @returns `true` if the ID is valid; `false` otherwise.
 *
 * @example
 * isValidId('550e8400-e29b-41d4-a716-446655440000'); // true (valid UUID)
 * isValidId('invalid-id'); // false
 */
export function isValidId(id: string): boolean {
  return uuidSchema.safeParse(id).success;
}
