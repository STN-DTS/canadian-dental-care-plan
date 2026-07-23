/**
 * Utility functions for handling responses, adapted from React Router.
 * @see: https://github.com/remix-run/react-router/blob/main/packages/react-router/lib/router/router.ts
 */

/**
 * Set of HTTP status codes that represent redirects.
 */
export const redirectStatusCodes = new Set([301, 302, 303, 307, 308]);

/**
 * Checks if a given value is a Response object.
 */
export function isResponse(value: unknown): value is Response {
  // prettier-ignore
  return (
    value != null &&
    typeof value === "object" &&
    'status' in value && typeof value.status === "number" &&
    'statusText' in value && typeof value.statusText === "string" &&
    'headers' in value && typeof value.headers === "object" &&
    'body' in value && value.body !== undefined
  );
}

/**
 * Checks if a given status code is a redirect status code.
 */
export function isRedirectStatusCode(statusCode: number): boolean {
  return redirectStatusCodes.has(statusCode);
}

/**
 * Checks if a given value is a redirect Response object.
 * A redirect response is a Response object with a redirect status code and a Location header.
 * @param value The value to check.
 * @returns True if the value is a redirect Response object, false otherwise.
 */
export function isRedirectResponse(value: unknown): value is Response {
  // prettier-ignore
  return (
    isResponse(value) &&
    isRedirectStatusCode(value.status) &&
    value.headers.has("Location")
  );
}
