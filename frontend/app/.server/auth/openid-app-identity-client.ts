import { Cache, Context, Effect, Exit, Redacted, Result } from 'effect';
import { inject, injectable } from 'inversify';
import { ClientSecretPost, Configuration, clientCredentialsGrant, customFetch, discovery } from 'openid-client';
import type { CustomFetch, TokenEndpointResponse } from 'openid-client';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { clearTokenCaches, getCachedAccessToken } from '~/.server/auth/app-identity-token-cache';
import type { AcquireToken, IdentityKey, IssuedToken } from '~/.server/auth/app-identity-token-cache';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

/**
 * Issues OAuth client-credentials access tokens for the app identity. Caching is handled by {@link getCachedAccessToken}.
 */
@injectable()
export class OpenIdAppIdentityClient implements AppIdentityClient {
  private readonly httpClient: HttpClient;

  constructor(@inject(TYPES.HttpClient) httpClient: HttpClient) {
    this.httpClient = httpClient;
  }

  /**
   * Returns a bearer token for the given identity, from cache whenever possible.
   *
   * @throws An application error if the request is invalid, the token cannot be acquired, or it has expired.
   */
  @Traced()
  async getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>> {
    assertValidRequest(request);

    return await getCachedAccessToken(request, this.acquireToken);
  }

  /**
   * Requests a token from the issuer through this client's `fetch`. Used by the cache when it needs a new token.
   */
  private readonly acquireToken: AcquireToken = (key: IdentityKey) => Effect.provideService(requestToken(key), OpenIdFetch, this.fetch);

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
 * Empties the token and discovery caches. For tests only: the caches live for the whole process.
 */
export async function clearAppIdentityCaches(): Promise<void> {
  await Promise.all([clearTokenCaches(), Effect.runPromise(Cache.invalidateAll(configurations))]);
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
 * Supplies the client's `fetch` to the discovery cache lookup. The cache is module-level and cannot hold it,
 * so each token request provides it.
 */
class OpenIdFetch extends Context.Service<OpenIdFetch, CustomFetch>()('OpenIdFetch') {}

/**
 * OIDC discovery metadata per identity, kept for {@link CONFIGURATION_TTL_MS}. Failures are not cached.
 */
const configurations = Effect.runSync(
  Cache.makeWith(
    (key: IdentityKey) =>
      Effect.gen(function* () {
        const fetch = yield* OpenIdFetch;

        return yield* Effect.tryPromise({
          try: async () => await discoverConfiguration(key, fetch),
          catch: fetchFailedError,
        });
      }),
    { capacity: CONFIGURATION_CACHE_CAPACITY, timeToLive: (exit) => (Exit.isSuccess(exit) ? CONFIGURATION_TTL_MS : 0), requireServicesAt: 'lookup' },
  ),
);

/**
 * Fetches the issuer's OIDC discovery document using the identity's client authentication.
 */
async function discoverConfiguration(key: IdentityKey, fetch: CustomFetch): Promise<Configuration> {
  const issuer = new URL(key.issuer);
  const clientId = Redacted.value(key.clientId);
  const clientAuthentication = ClientSecretPost(Redacted.value(key.clientSecret));

  return await discovery(issuer, clientId, undefined, clientAuthentication, { [customFetch]: fetch, timeout: 10 });
}

/**
 * Requests a token with the client-credentials grant, using the cached discovery metadata. A failed token request
 * drops the cached metadata so the endpoint is rediscovered next time.
 */
function requestToken(key: IdentityKey): Effect.Effect<IssuedToken, AppError, OpenIdFetch> {
  return Effect.gen(function* () {
    const fetch = yield* OpenIdFetch;
    const cached = yield* Cache.get(configurations, key);
    const configuration = bindFetch(cached, key, fetch);
    const requestedAt = Temporal.Now.instant().epochMilliseconds;
    const response = yield* Effect.tryPromise({
      try: async () => await clientCredentialsGrant(configuration, { scope: key.scope }),
      catch: fetchFailedError,
    }).pipe(Effect.tapError(() => Cache.invalidate(configurations, key)));

    if (!isUsableTokenResponse(response)) {
      return yield* Effect.fail(new AppError('App identity token response is invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE));
    }

    return { value: Redacted.make(response.access_token), requestedAt, lifetimeMs: response.expires_in * 1000 };
  });
}

/**
 * Copies the cached discovery result into a `Configuration` that uses the caller's `fetch`. A `Configuration`
 * keeps the `fetch` it was created with, so reusing the cached one would send every token request through whichever
 * client discovered first.
 */
function bindFetch(cached: Configuration, key: IdentityKey, fetch: CustomFetch): Configuration {
  const configuration = new Configuration(cached.serverMetadata(), Redacted.value(key.clientId), undefined, ClientSecretPost(Redacted.value(key.clientSecret)));
  configuration.timeout = cached.timeout;
  configuration[customFetch] = fetch;

  return configuration;
}

/**
 * Checks that the issuer's response is usable as an `Authorization: Bearer` credential with a known lifetime.
 * The library already validates the protocol; header-safe characters and a positive `expires_in` are local requirements.
 */
function isUsableTokenResponse(response: TokenEndpointResponse): response is TokenEndpointResponse & { expires_in: number } {
  return response.token_type === 'bearer' && /^[A-Za-z0-9._~+/-]+=*$/.test(response.access_token) && response.expires_in !== undefined && Number.isFinite(response.expires_in) && response.expires_in > 0;
}
