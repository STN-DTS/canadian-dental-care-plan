import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';
import { subtle } from 'node:crypto';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { FetchFn, HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { generateCryptoKey, generateJwkId } from '~/.server/utils/crypto-utils';
import type { ClientMetadata, IdToken, UserinfoToken } from '~/.server/utils/raoidc-utils';
import * as raoidcUtils from '~/.server/utils/raoidc-utils';
import { expandTemplate } from '~/utils/string-utils';

export interface RaoidcService {
  /**
   * Generates an OIDC signin request.
   *
   * @param redirectUri - The URI to redirect the user to after successful authentication.
   * @returns A promise resolving to a `SigninRequest` containing the authentication URL, code verifier, and state.
   */
  generateSigninRequest(redirectUri: string): Promise<SigninRequest>;

  /**
   * Generates an OIDC signout request.
   *
   * @param args - Parameters for the signout request.
   * @returns A URL string to redirect the user for signing out.
   */
  generateSignoutRequest(args: GenerateSignoutRequestArgs): string;

  /**
   * Handles the OIDC callback request.
   *
   * @param args - Parameters for handling the callback.
   * @returns A promise resolving to an object containing the access token, ID token, and user info token.
   */
  handleCallback(args: HandleCallbackArgs): Promise<HandleCallbackResult>;
}

/**
 * Parameters for generating an OIDC signout request.
 */
interface GenerateSignoutRequestArgs {
  /** The session ID to be terminated. */
  sessionId: string;
  /** The locale for the signout request. */
  locale: AppLocale;
}

/**
 * Parameters for handling the OIDC callback request.
 */
interface HandleCallbackArgs {
  /** The HTTP request URL containing the callback data. */
  requestUrl: URL;
  /** The code verifier used in the initial signin request. */
  codeVerifier: string;
  /** The expected state to validate against the callback state parameter. */
  expectedState: string;
  /** The URI to redirect the user to after handling the callback. */
  redirectUri: string;
}

/**
 * Result of handling the OIDC callback request.
 */
interface HandleCallbackResult {
  /** The access token issued by the OIDC provider. */
  accessToken: string;
  /** The ID token issued by the OIDC provider. */
  idToken: IdToken;
  /** The user information token. */
  userInfoToken: UserinfoToken;
}

/**
 * Details of a signin request.
 */
interface SigninRequest {
  /** The URL to initiate the signin process. */
  authUrl: URL;
  /** The code verifier for the PKCE flow. */
  codeVerifier: string;
  /** The state to maintain session consistency. */
  state: string;
}

/**
 * The RAOIDC Service is responsible for all RAOIDC interactions in the
 * application.
 *
 * If an HTTP proxy is configured (via the HTTP_PROXY_URL environment
 * variable), the service will make all RAOIDC calls with a custom fetch()
 * function that uses that HTTP proxy. This is most commonly used during
 * development, when the nonprod RAOIDC instance is not accessible outside of
 * the ESDC network.
 */
@injectable()
export class DefaultRaoidcService implements RaoidcService {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'AUTH_RAOIDC_BASE_URL' | 'AUTH_RAOIDC_CLIENT_ID' | 'AUTH_RAOIDC_METADATA_CACHE_TTL_SECONDS' | 'AUTH_JWT_PRIVATE_KEY' | 'AUTH_LOGOUT_REDIRECT_URL' | 'HTTP_PROXY_URL'>;
  private readonly fetchFn: FetchFn;

  constructor(
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'AUTH_RAOIDC_BASE_URL' | 'AUTH_RAOIDC_CLIENT_ID' | 'AUTH_RAOIDC_METADATA_CACHE_TTL_SECONDS' | 'AUTH_JWT_PRIVATE_KEY' | 'AUTH_LOGOUT_REDIRECT_URL' | 'HTTP_PROXY_URL'>,
    @inject(TYPES.HttpClient) httpClient: HttpClient,
  ) {
    this.log = createLogger('DefaultRaoidcService');
    this.serverConfig = serverConfig;
    this.fetchFn = httpClient.getFetchFn({ proxyUrl: serverConfig.HTTP_PROXY_URL });
    this.init();
  }

  private init(): void {
    // Configure caching for raoidc operations
    const raoidcMetadataCacheTTL = 1000 * this.serverConfig.AUTH_RAOIDC_METADATA_CACHE_TTL_SECONDS;

    this.fetchServerMetadata = memoize(this.fetchServerMetadata, {
      async: true,
      expires: raoidcMetadataCacheTTL,
    });

    type MemoizedFetchServerMetadata = Memoized<typeof this.fetchServerMetadata, Options<typeof this.fetchServerMetadata>>;
    (this.fetchServerMetadata as MemoizedFetchServerMetadata).cache.on('add', () => {
      this.log.info('Creating new fetchServerMetadata memo');
    });

    this.log.debug('DefaultRaoidcService initiated.');
  }

  async generateSigninRequest(redirectUri: string): Promise<SigninRequest> {
    this.log.debug('Generating OIDC signin request');
    const { AUTH_RAOIDC_BASE_URL } = this.serverConfig;

    const { codeChallenge, codeVerifier } = raoidcUtils.generateCodeChallenge();
    const clientId = this.serverConfig.AUTH_RAOIDC_CLIENT_ID;
    const scope = 'openid profile';
    const state = raoidcUtils.generateRandomState();
    const { serverMetadata } = await this.fetchServerMetadata(AUTH_RAOIDC_BASE_URL, this.fetchFn);
    const authUrl = raoidcUtils.generateAuthorizationRequest(serverMetadata.authorization_endpoint, clientId, codeChallenge, redirectUri, scope, state);

    return { authUrl, codeVerifier, state };
  }

  generateSignoutRequest({ sessionId, locale }: GenerateSignoutRequestArgs): string {
    this.log.debug('Generating OIDC signout request');
    const { AUTH_LOGOUT_REDIRECT_URL, AUTH_RAOIDC_CLIENT_ID } = this.serverConfig;
    return expandTemplate(AUTH_LOGOUT_REDIRECT_URL, { clientId: AUTH_RAOIDC_CLIENT_ID, sharedSessionId: sessionId, uiLocales: locale });
  }

  async handleCallback({ requestUrl, codeVerifier, expectedState, redirectUri }: HandleCallbackArgs): Promise<HandleCallbackResult> {
    this.log.debug('Handling OIDC callback');
    const { AUTH_JWT_PRIVATE_KEY, AUTH_RAOIDC_BASE_URL, AUTH_RAOIDC_CLIENT_ID } = this.serverConfig;

    const { searchParams } = requestUrl;
    const authCode = searchParams.get('code');
    const error = searchParams.get('error');
    const state = searchParams.get('state');

    if (error) {
      throw new Error(`Unexpected error: ${error}`);
    }

    if (!authCode) {
      throw new Error('Missing authorization code in response');
    }

    if (state !== expectedState) {
      throw new Error(`CSRF error: incoming state [${state}] does not match expected state [${expectedState}]`);
    }

    const privateDecryptionKey = await generateCryptoKey(AUTH_JWT_PRIVATE_KEY, 'decrypt');
    const privateSigningKey = await generateCryptoKey(AUTH_JWT_PRIVATE_KEY, 'sign');
    const privateKeyId = generateJwkId(await subtle.exportKey('jwk', privateSigningKey));

    const client: ClientMetadata = {
      clientId: AUTH_RAOIDC_CLIENT_ID,
      privateDecryptionKey: privateDecryptionKey,
      privateSigningKey: privateSigningKey,
      privateKeyId: privateKeyId,
    };

    const { jwkSet, serverMetadata } = await this.fetchServerMetadata(AUTH_RAOIDC_BASE_URL, this.fetchFn);
    const { accessToken, idToken } = await raoidcUtils.fetchAccessToken(serverMetadata, jwkSet, authCode, client, codeVerifier, redirectUri, this.fetchFn);
    const userInfoToken = await raoidcUtils.fetchUserInfo(serverMetadata.userinfo_endpoint, jwkSet, accessToken, client, this.fetchFn);

    return { accessToken, idToken, userInfoToken };
  }

  protected fetchServerMetadata = raoidcUtils.fetchServerMetadata;
}
