import { useAuthenticityToken } from 'remix-utils/csrf/react';

/**
 * Retrieves the authenticity token used to protect form submissions from CSRF attacks.
 *
 * @returns The current authenticity token.
 */
export function useCsrfToken(): string {
  return useAuthenticityToken();
}
