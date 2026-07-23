import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { FetchFn, HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { validateSession } from '~/.server/utils/raoidc-utils';
import type { Session } from '~/.server/web/session';

/**
 * Parameters for RAOIDC session validation.
 */
export interface ValidateRaoidcSessionParams {
  /**
   * The session object to validate, containing RAOIDC tokens.
   */
  session: Session;
}

/**
 * Result of RAOIDC session validation.
 */
export type ValidateRaoidcSessionResult = { isValid: true } | { isValid: false; errorMessage: string };

/**
 * Provides functionality to validate RAOIDC sessions.
 */
export interface RaoidcSessionValidator {
  /**
   * Validates the RAOIDC session by checking the presence and validity of session tokens.
   *
   * @param params - The session object to validate.
   * @returns The result of the session validation.
   */
  validateRaoidcSession(params: ValidateRaoidcSessionParams): Promise<ValidateRaoidcSessionResult>;
}

@injectable()
export class DefaultRaoidcSessionValidator implements RaoidcSessionValidator {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'AUTH_RAOIDC_BASE_URL' | 'AUTH_RAOIDC_CLIENT_ID' | 'HTTP_PROXY_URL'>;
  private readonly fetchFn: FetchFn;

  constructor(@inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'AUTH_RAOIDC_BASE_URL' | 'AUTH_RAOIDC_CLIENT_ID' | 'HTTP_PROXY_URL'>, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.log = createLogger('DefaultRaoidcSessionValidator');
    this.serverConfig = serverConfig;
    this.fetchFn = httpClient.getFetchFn({ proxyUrl: serverConfig.HTTP_PROXY_URL });
  }

  async validateRaoidcSession({ session }: ValidateRaoidcSessionParams): Promise<ValidateRaoidcSessionResult> {
    this.log.debug('Performing RAOIDC session [%s] validation', session.id);
    const { AUTH_RAOIDC_BASE_URL, AUTH_RAOIDC_CLIENT_ID } = this.serverConfig;

    const idTokenOption = session.find('idToken');
    if (idTokenOption.isNone()) {
      this.log.debug('idToken not found in session [%s]', session.id);
      return { isValid: false, errorMessage: `RAOIDC session validation failed; idToken not found in session [${session.id}]` };
    }

    const userInfoTokenOption = session.find('userInfoToken');
    if (userInfoTokenOption.isNone()) {
      this.log.debug('userInfoToken not found in session [%s]', session.id);
      return { isValid: false, errorMessage: `RAOIDC session validation failed; userInfoToken not found in session [${session.id}]` };
    }

    const idToken = idTokenOption.unwrap();
    const userInfoToken = userInfoTokenOption.unwrap();

    if (userInfoToken.mocked) {
      this.log.debug('Mocked user; skipping RAOIDC session [%s] validation', session.id);
      return { isValid: true };
    }

    // idToken.sid is the RAOIDC session id
    const sessionValid = await validateSession(AUTH_RAOIDC_BASE_URL, AUTH_RAOIDC_CLIENT_ID, idToken.sid, this.fetchFn);

    if (!sessionValid) {
      this.log.debug('RAOIDC session [%s] has expired', session.id);
      return { isValid: false, errorMessage: `RAOIDC session validation failed; session [${session.id}] has expired` };
    }

    this.log.debug('Authentication check passed for RAOIDC session [%s]', session.id);
    return { isValid: true };
  }
}
