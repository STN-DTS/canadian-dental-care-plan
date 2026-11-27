import { ATTR_ERROR_TYPE, ERROR_TYPE_VALUE_OTHER } from '@opentelemetry/semantic-conventions';
import { Redacted } from 'effect';
import { inject, injectable } from 'inversify';
import {
  AuthorizationResponseError,
  ClientError,
  PrivateKeyJwt,
  ResponseBodyError,
  authorizationCodeGrant,
  buildAuthorizationUrl,
  calculatePKCECodeChallenge,
  customFetch,
  discovery,
  enableNonRepudiationChecks,
  modifyAssertion,
  randomNonce,
  randomPKCECodeVerifier,
  randomState,
} from 'openid-client';
import type { Configuration, CustomFetch } from 'openid-client';

import type { AuthCallbackResult, AuthService, AuthSigninRequest, HandleAuthCallbackArgs } from '~/.server/auth/auth-service';
import type { OpenIdServiceConfig } from '~/.server/auth/openid-service-config';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { parsePrivateKey } from '~/.server/utils/crypto-utils';
import { createAppError } from '~/.server/utils/error-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import type { HttpStatusCode } from '~/constants/http-status-codes';
import type { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import type { ErrorCode } from '~/errors/error-codes';

const log = createLogger('DefaultOpenIdService');

/** Connectivity proof only; profile, email and AccountMapper scopes belong to the full sign-in (8845). */
const SCOPE = 'openid';

/** Error codes the provider can return at the callback or token endpoint (RFC 6749 sections 4.1.2.1 and 5.2, OIDC Core 3.1.2.6). */
const OAUTH_ERROR_CODES = new Set([
  'access_denied',
  'account_selection_required',
  'consent_required',
  'interaction_required',
  'invalid_client',
  'invalid_grant',
  'invalid_request',
  'invalid_scope',
  'login_required',
  'server_error',
  'temporarily_unavailable',
  'unauthorized_client',
  'unsupported_grant_type',
  'unsupported_response_type',
]);

/** Library failures meaning the token response, including the ID token signature and claims, failed validation. */
const VALIDATION_ERROR_CODES = new Set(['OAUTH_INVALID_RESPONSE', 'OAUTH_JSON_ATTRIBUTE_COMPARISON_FAILED', 'OAUTH_JWT_CLAIM_COMPARISON_FAILED', 'OAUTH_JWT_TIMESTAMP_CHECK_FAILED', 'OAUTH_KEY_SELECTION_FAILED', 'OAUTH_PARSE_ERROR']);

/**
 * iSAMS OIDC connectivity proof: authorization code flow with PKCE (S256) and `private_key_jwt` (RS256) client
 * authentication. Endpoints come from the issuer's discovery document, and the ID token's signature, issuer, audience,
 * expiry and nonce are validated.
 *
 * The callback only reports that the exchange was verified. Tokens and claims are discarded; no CDCP session is created.
 */
@injectable()
export class DefaultOpenIdService implements AuthService {
  readonly provider = 'oidc';

  private readonly config: OpenIdServiceConfig;
  private readonly httpClient: HttpClient;
  private signingKey?: Promise<CryptoKey>;

  constructor(@inject(TYPES.OpenIdServiceConfig) config: OpenIdServiceConfig, @inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.config = config;
    this.httpClient = httpClient;
  }

  @Traced()
  async generateSigninRequest(): Promise<AuthSigninRequest> {
    log.debug('Generating OIDC connectivity sign-in request');
    const configuration = await this.discover();

    const correlation = { state: randomState(), nonce: randomNonce(), codeVerifier: randomPKCECodeVerifier() };
    const codeChallenge = await calculatePKCECodeChallenge(correlation.codeVerifier);
    let authUrl: URL;

    try {
      authUrl = buildAuthorizationUrl(configuration, {
        redirect_uri: this.config.redirectUri.href,
        scope: SCOPE,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        state: correlation.state,
        nonce: correlation.nonce,
      });
    } catch (error) {
      // A missing or non-HTTPS authorization_endpoint in the discovered metadata.
      throw connectivityError('OIDC discovery failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, HttpStatusCodes.BAD_GATEWAY, libraryErrorType(error));
    }

    return { authUrl, correlation };
  }

  @Traced()
  async handleCallback({ callbackUrl, correlation }: HandleAuthCallbackArgs): Promise<AuthCallbackResult> {
    log.debug('Handling OIDC connectivity callback');
    const { redirectUri } = this.config;
    const { searchParams } = callbackUrl;

    if (callbackUrl.pathname !== redirectUri.pathname) {
      throw callbackInvalidError('unexpected_callback_path');
    }

    if (searchParams.has('error')) {
      throw providerError(searchParams.get('error'));
    }

    if (searchParams.getAll('code').length !== 1 || !searchParams.get('code')) {
      throw callbackInvalidError('authorization_code_missing_or_duplicated');
    }

    if (searchParams.getAll('state').length !== 1 || searchParams.get('state') !== correlation.state) {
      throw callbackInvalidError('state_missing_mismatched_or_duplicated');
    }

    if (searchParams.getAll('code').length !== 1 || searchParams.getAll('state').length !== 1) {
      throw callbackInvalidError('duplicate_callback_parameters');
    }

    const configuration = await this.discover();

    // Rebuilt from the configured URI so the token request sends exactly the redirect_uri used at authorization.
    const currentUrl = new URL(redirectUri);
    currentUrl.search = callbackUrl.search;

    let tokens: Awaited<ReturnType<typeof authorizationCodeGrant>>;

    try {
      tokens = await authorizationCodeGrant(configuration, currentUrl, {
        expectedNonce: correlation.nonce,
        expectedState: correlation.state,
        idTokenExpected: true,
        pkceCodeVerifier: correlation.codeVerifier,
      });
    } catch (error) {
      throw tokenRequestError(error);
    }

    if (tokens.claims() === undefined) {
      throw tokenResponseInvalidError('id_token_missing');
    }

    log.info('OIDC connectivity verified');
    return { outcome: 'connectivity-verified', authenticated: false, issuer: configuration.serverMetadata().issuer };
  }

  /**
   * Discovers the issuer's endpoints and binds `private_key_jwt` client authentication, with ID token signature
   * checks enabled. Not cached, so every attempt proves discovery is reachable.
   */
  private async discover(): Promise<Configuration> {
    const { clientAssertionAudience, clientId, issuer, privateKeyId } = this.config;
    const key = await this.getSigningKey();
    let audience: string | undefined;

    const clientAuthentication = PrivateKeyJwt(
      { key, kid: privateKeyId },
      {
        [modifyAssertion]: (_header, payload) => {
          if (audience) {
            payload.aud = audience;
          }
        },
      },
    );

    let configuration: Configuration;

    try {
      configuration = await discovery(issuer, clientId, undefined, clientAuthentication, { [customFetch]: this.fetch, timeout: 10, execute: [enableNonRepudiationChecks] });
    } catch (error) {
      throw connectivityError('OIDC discovery failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, HttpStatusCodes.BAD_GATEWAY, libraryErrorType(error));
    }

    const metadata = configuration.serverMetadata();
    audience = clientAssertionAudience === 'issuer' ? metadata.issuer : metadata.token_endpoint;

    if (!audience) {
      throw connectivityError('OIDC discovery failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_DISCOVERY_FAILED, HttpStatusCodes.BAD_GATEWAY, 'token_endpoint_missing');
    }

    return configuration;
  }

  private async getSigningKey(): Promise<CryptoKey> {
    this.signingKey ??= importSigningKey(this.config.privateKey);
    return await this.signingKey;
  }

  /**
   * `fetch` for openid-client so discovery, JWKS and token requests use the instrumented HTTP client and proxy.
   * Redirects are refused and retries are disabled so the client assertion and code are only sent once.
   */
  private readonly fetch: CustomFetch = async (url, options) => {
    const response = await this.httpClient.instrumentedFetch(`http.client.oidc-connectivity.${options.method === 'GET' ? 'gets' : 'posts'}`, url, {
      ...options,
      proxyUrl: this.config.httpProxyUrl,
      redirect: 'error',
      retryOptions: { retries: 0, retryConditions: {} },
    });

    return new globalThis.Response(await response.arrayBuffer(), { status: response.status, statusText: response.statusText, headers: [...response.headers] });
  };
}

/** Imports the registered key for RS256 (RSASSA-PKCS1-v1_5 with SHA-256); the key is not extractable. */
async function importSigningKey(privateKey: Redacted.Redacted<string>): Promise<CryptoKey> {
  const der = parsePrivateKey(Redacted.value(privateKey)).export({ format: 'der', type: 'pkcs8' });
  return await globalThis.crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
}

/** Only allowlisted OAuth codes are logged; provider descriptions and URIs can carry arbitrary text. */
function oauthErrorType(code: unknown): string {
  return typeof code === 'string' && OAUTH_ERROR_CODES.has(code) ? code : ERROR_TYPE_VALUE_OTHER;
}

/**
 * openid-client and oauth4webapi error codes are library constants, so they are safe to log; messages and causes are
 * not. Some failures, such as missing server metadata, come straight from oauth4webapi rather than as a `ClientError`.
 */
function libraryErrorType(error: unknown): string {
  if (error instanceof ClientError && typeof error.code === 'string') {
    return error.code;
  }

  const code = error instanceof Error && 'code' in error ? error.code : undefined;
  return typeof code === 'string' && /^OAUTH_[A-Z_]+$/.test(code) ? code : ERROR_TYPE_VALUE_OTHER;
}

/**
 * Creates a connectivity error carrying a bounded failure reason in `meta.reason` (a fixed string, allowlisted OAuth
 * code or library error code, never provider text). The auth route logs it once with that reason; here it is only a
 * debug breadcrumb.
 */
function connectivityError(message: string, errorCode: ErrorCode, httpStatusCode: HttpStatusCode, reason: string): AppError {
  log.debug('OIDC connectivity check failed', { [ATTR_ERROR_TYPE]: reason });
  return createAppError(message, errorCode, { httpStatusCode, meta: { reason } });
}

function callbackInvalidError(reason: string): AppError {
  return connectivityError('OIDC callback is invalid.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_CALLBACK_INVALID, HttpStatusCodes.BAD_REQUEST, reason);
}

function providerError(code: unknown): AppError {
  return connectivityError('OIDC provider returned an error.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_PROVIDER_ERROR, HttpStatusCodes.BAD_REQUEST, oauthErrorType(code));
}

function tokenResponseInvalidError(reason: string): AppError {
  return connectivityError('OIDC token response is invalid.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_RESPONSE_INVALID, HttpStatusCodes.BAD_GATEWAY, reason);
}

/**
 * Classifies a failed code exchange without exposing tokens, codes or provider text: validation failures mean the
 * response or ID token was rejected; provider rejections, transport failures and anything else are exchange failures.
 */
function tokenRequestError(error: unknown): AppError {
  if (error instanceof ResponseBodyError) {
    return connectivityError('OIDC token exchange failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED, HttpStatusCodes.BAD_GATEWAY, oauthErrorType(error.error));
  }

  if (error instanceof AuthorizationResponseError) {
    return providerError(error.error);
  }

  if (error instanceof ClientError && VALIDATION_ERROR_CODES.has(error.code ?? '')) {
    return tokenResponseInvalidError(libraryErrorType(error));
  }

  return connectivityError('OIDC token exchange failed.', ErrorCodes.AUTH_OIDC_CONNECTIVITY_TOKEN_EXCHANGE_FAILED, HttpStatusCodes.BAD_GATEWAY, libraryErrorType(error));
}
