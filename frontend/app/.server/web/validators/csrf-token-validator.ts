import { injectable } from 'inversify';

import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Parameters for CSRF token validation.
 */
export interface ValidateCsrfTokenParams {
  requestToken: string;
  sessionToken: string;
}

/**
 * Result of CSRF token validation.
 */
export type ValidateCsrfTokenResult = { isValid: true } | { isValid: false; errorMessage: string };

/**
 * Interface for validating CSRF tokens.
 */
export interface CsrfTokenValidator {
  /**
   * Validates the CSRF token from the request against the token stored in the session.
   *
   * @param params - An object containing the request token and session token.
   * @returns A result indicating whether the token is valid and, if not, an error message.
   */
  validateCsrfToken(params: ValidateCsrfTokenParams): ValidateCsrfTokenResult;
}

@injectable()
export class DefaultCsrfTokenValidator implements CsrfTokenValidator {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultCsrfTokenValidator');
  }

  validateCsrfToken({ requestToken, sessionToken }: ValidateCsrfTokenParams): ValidateCsrfTokenResult {
    this.log.debug('Starting CSRF token validation; requestToken: %s, sessionToken: %s', requestToken, sessionToken);

    if (requestToken !== sessionToken) {
      this.log.warn('Invalid CSRF token detected; requestToken: [%s], sessionToken: [%s]', requestToken, sessionToken);
      return {
        isValid: false,
        errorMessage: 'CSRF token validation failed; Invalid CSRF token detected',
      };
    }

    this.log.debug('CSRF token validation successful; requestToken: [%s], sessionToken: [%s]', requestToken, sessionToken);
    return { isValid: true };
  }
}
