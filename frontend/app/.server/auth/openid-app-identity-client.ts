import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { Cache, Effect, Exit, Redacted, Result } from 'effect';
import { inject, injectable } from 'inversify';
import { ClientSecretPost, clientCredentialsGrant, customFetch, discovery } from 'openid-client';
import type { Configuration, CustomFetch, TokenEndpointResponse } from 'openid-client';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import type { AcquireToken, AppIdentityTokenCache, IdentityKey, IssuedToken } from '~/.server/auth/app-identity-token-cache';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { createLogger } from '~/.server/logging';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const log = createLogger('OpenIdAppIdentityClient');

type ConfigurationCache = Cache.Cache<IdentityKey, Configuration, AppError>;

/**
 * Issues OAuth client-credentials access tokens for the app identity. Token caching is handled by {@link AppIdentityTokenCache}.
 *
 * Each instance owns its discovery cache, like the token cache, so both are shared only when the instance is shared.
 * The container binds this client as a singleton.
 */
@injectable()
export class OpenIdAppIdentityClient implements AppIdentityClient {
  private readonly httpClient: HttpClient;
  private readonly tokenCache: AppIdentityTokenCache;
  private readonly configurations: ConfigurationCache;

  constructor(@inject(TYPES.HttpClient) httpClient: HttpClient, @inject(TYPES.AppIdentityTokenCache) tokenCache: AppIdentityTokenCache) {
    this.httpClient = httpClient;
    this.tokenCache = tokenCache;
    this.configurations = createConfigurationCache(this.fetch);
  }

  /**
   * Returns a bearer token for the given identity, from cache whenever possible.
   *
   * @throws An application error if the request is invalid, the token cannot be acquired, or it has expired.
   */
  @Traced()
  async getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>> {
    assertValidRequest(request);

    return await this.tokenCache.getAccessToken(request, this.acquireToken);
  }

  /**
   * Requests a token from the issuer. Used by the token cache when it needs a new token.
   */
  private readonly acquireToken: AcquireToken = (key: IdentityKey) => requestToken(key, this.configurations);

  /**
   * `fetch` handed to openid-client so discovery and token requests go through the instrumented HTTP client.
   * Redirects are refused and retries are disabled so credentials are only sent once, to the intended endpoint.
   */
  private readonly fetch: CustomFetch = async (url, options) => {
    const response = await this.httpClient.instrumentedFetch(`http.client.app-identity.${options.method === 'GET' ? 'discovery.gets' : 'token.posts'}`, url, {
      ...options,
      redirect: 'error',
      retryOptions: { retries: 0, retryConditions: {} },
    });

    return new globalThis.Response(await response.arrayBuffer(), { status: response.status, statusText: response.statusText, headers: [...response.headers] });
  };
}

/**
 * How long discovery metadata is reused, so endpoint changes are eventually picked up.
 */
const CONFIGURATION_TTL_MS = 3_600_000;

/**
 * Maximum number of identities whose discovery metadata is retained.
 */
const CONFIGURATION_CACHE_CAPACITY = 100;

/**
 * Rejects requests that could send credentials to an unsafe or unintended place: an invalid issuer
 * (see `validateOAuthIssuer`) or blank credentials and scope.
 *
 * @throws An application error with `AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST` when the request is invalid.
 */
function assertValidRequest({ issuer, clientId, clientSecret, scope }: GetAccessTokenRequest): void {
  const isInvalid = Result.isFailure(validateOAuthIssuer(issuer.href)) || !Redacted.value(clientId).trim() || !Redacted.value(clientSecret).trim() || !scope.trim();

  if (isInvalid) {
    log.debug('App identity request rejected', { [ATTR_ERROR_TYPE]: 'invalid_app_identity_request' });
    throwAppError('App identity arguments are invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_REQUEST);
  }
}

/**
 * Generic acquisition failure; transport and parser errors can contain credentials or response bodies, so callers only ever see this.
 */
function fetchFailedError(): AppError {
  return new AppError('App identity token acquisition failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED);
}

/**
 * OIDC discovery metadata per identity, kept for {@link CONFIGURATION_TTL_MS}. Failures are not cached.
 * The metadata is bound to the given `fetch`, so token requests made with it use the same `fetch`.
 */
function createConfigurationCache(fetch: CustomFetch): ConfigurationCache {
  return Effect.runSync(
    Cache.makeWith(
      (key: IdentityKey) =>
        Effect.tryPromise({
          try: async () => await discoverConfiguration(key, fetch),
          catch: fetchFailedError,
        }),
      { capacity: CONFIGURATION_CACHE_CAPACITY, timeToLive: (exit) => (Exit.isSuccess(exit) ? CONFIGURATION_TTL_MS : 0) },
    ),
  );
}

/**
 * Fetches the issuer's OIDC discovery document using the identity's client authentication.
 */
async function discoverConfiguration(key: IdentityKey, fetch: CustomFetch): Promise<Configuration> {
  log.debug('Discovering OpenID configuration');

  const issuer = new URL(key.issuer);
  const clientId = Redacted.value(key.clientId);
  const clientAuthentication = ClientSecretPost(Redacted.value(key.clientSecret));

  return await discovery(issuer, clientId, undefined, clientAuthentication, { [customFetch]: fetch, timeout: 10 });
}

/**
 * Drops the cached discovery metadata so the endpoint is rediscovered on the next token request.
 */
function discardConfiguration(configurations: ConfigurationCache, key: IdentityKey): Effect.Effect<void> {
  return Cache.invalidate(configurations, key).pipe(
    Effect.andThen(
      Effect.sync(() => {
        log.debug('Discarded cached OpenID configuration after a failed token request');
      }),
    ),
  );
}

/**
 * Requests a token with the client-credentials grant, using the cached discovery metadata. A failed token request
 * drops the cached metadata so the endpoint is rediscovered next time.
 */
function requestToken(key: IdentityKey, configurations: ConfigurationCache): Effect.Effect<IssuedToken, AppError> {
  return Effect.gen(function* () {
    const configuration = yield* Cache.get(configurations, key);
    const requestedAt = Temporal.Now.instant().epochMilliseconds;
    const response = yield* Effect.tryPromise({
      try: async () => await clientCredentialsGrant(configuration, { scope: key.scope }),
      catch: fetchFailedError,
    }).pipe(Effect.tapError(() => discardConfiguration(configurations, key)));

    if (!isUsableTokenResponse(response)) {
      return yield* Effect.fail(new AppError('App identity token response is invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE));
    }

    return { value: Redacted.make(response.access_token), requestedAt, lifetimeMs: response.expires_in * 1000 };
  });
}

/**
 * Checks that the issuer's response is usable as an `Authorization: Bearer` credential with a known lifetime.
 * The library already validates the protocol; header-safe characters and a positive `expires_in` are local requirements.
 */
function isUsableTokenResponse(response: TokenEndpointResponse): response is TokenEndpointResponse & { expires_in: number } {
  return response.token_type === 'bearer' && /^[A-Za-z0-9._~+/-]+=*$/.test(response.access_token) && response.expires_in !== undefined && Number.isFinite(response.expires_in) && response.expires_in > 0;
}
