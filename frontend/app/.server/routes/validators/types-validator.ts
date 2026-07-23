/**
 * Result type for an unsuccessful validation, containing detailed error messages
 * for each invalid field in the validated object.
 *
 * @template T - The type of object being validated.
 */
export interface InvalidResult<T extends object> {
  success: false;
  errors: Readonly<Partial<Record<keyof T, string | undefined>>>;
}

/**
 * Result type for a successful validation, containing the validated object data.
 *
 * @template T - The type of object being validated.
 */
export interface ValidResult<T extends object> {
  success: true;
  data: T;
}
