import { Cache, Context, Data, Effect, Exit, Option, Redacted, Result } from 'effect';
import { inject, injectable } from 'inversify';
import { ClientSecretPost, Configuration, clientCredentialsGrant, customFetch, discovery } from 'openid-client';
import type { CustomFetch, TokenEndpointResponse } from 'openid-client';

import type { AppIdentityClient, GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { TYPES } from '~/.server/constants';
import type { HttpClient } from '~/.server/http';
import { Traced } from '~/.server/observability/decorator';
import { throwAppError } from '~/.server/utils/error-utils';
import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

/** Maximum number of identities retained by each cache; the least recently used entries are evicted beyond this. */
const CACHE_CAPACITY = 100;
/** How long a failed acquisition is remembered, so an issuer outage is not hit by every caller. */
const FAILURE_TTL_MS = 5_000;
/** How long discovery metadata is reused, so endpoint changes are eventually picked up. */
const CONFIGURATION_TTL_MS = 3_600_000;
/** Fraction of a token's lifetime before its expiry at which a refresh starts (capped by {@link MAX_REFRESH_MARGIN_MS}). */
const REFRESH_MARGIN_RATIO = 0.1;
/** Upper bound on how long before expiry a refresh starts. */
const MAX_REFRESH_MARGIN_MS = 60_000;

/** Current time as epoch milliseconds, the unit shared by `AccessToken` deadlines and cache TTLs. */
const nowMs = () => Temporal.Now.instant().epochMilliseconds;

/** A cached access token and the two deadlines that govern how it is used (epoch milliseconds). */
interface AccessToken {
  /** The bearer token, redacted so it is not exposed by logging or inspection. */
  readonly value: Redacted.Redacted<string>;
  /** After this instant the token is served while a background refresh runs. */
  readonly refreshAt: number;
  /** After this instant the token must never be returned. */
  readonly expiresAt: number;
}

/**
 * Cache key for one app identity: issuer, credentials, scope.
 *
 * Same identity = same key, so callers share one token. Any change (e.g. rotated secret) = new key.
 */
class IdentityKey extends Data.Class<{
  readonly issuer: string;
  readonly clientId: Redacted.Redacted<string>;
  readonly clientSecret: Redacted.Redacted<string>;
  readonly scope: string;
}> {
  /** Issuer kept as `href` string: `URL` compares by reference. */
  constructor({ issuer, clientId, clientSecret, scope }: GetAccessTokenRequest) {
    super({ issuer: issuer.href, clientId, clientSecret, scope });
  }
}

/** Failure to obtain an app identity token. Its message is safe to surface and never contains secrets. */
class AppIdentityError extends AppError {}

/** Generic acquisition failure; transport and parser errors can contain credentials or response bodies, so callers only ever see this. */
const fetchFailedError = () => new AppIdentityError('App identity token acquisition failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED);
/** The issued token's usable lifetime had already elapsed (for example, a very slow token request). */
const tokenExpiredError = () => new AppIdentityError('App identity token expired before use.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);

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
 * Checks that the issuer's response is usable as an `Authorization: Bearer` credential with a known lifetime.
 * The library already validates the protocol; header-safe characters and a positive `expires_in` are local requirements.
 */
function isUsableTokenResponse(response: TokenEndpointResponse): response is TokenEndpointResponse & { expires_in: number } {
  return response.token_type === 'bearer' && /^[A-Za-z0-9._~+/-]+=*$/.test(response.access_token) && response.expires_in !== undefined && Number.isFinite(response.expires_in) && response.expires_in > 0;
}

/**
 * Builds a token with its two deadlines, both measured from when the request started so that
 * request latency is subtracted from the token's usable lifetime.
 *
 * - `refreshAt`: lifetime minus the refresh margin (10%, at most 60s).
 * - `expiresAt`: lifetime minus half the refresh margin, a safety buffer so a returned token is still valid downstream.
 *
 * @param response A response that passed {@link isUsableTokenResponse}.
 * @param startedAt Epoch milliseconds captured just before the token request was sent.
 */
function toAccessToken(response: TokenEndpointResponse & { expires_in: number }, startedAt: number): AccessToken {
  const lifetimeMs = response.expires_in * 1000;
  const refreshMarginMs = Math.min(MAX_REFRESH_MARGIN_MS, lifetimeMs * REFRESH_MARGIN_RATIO);

  return {
    value: Redacted.make(response.access_token),
    refreshAt: startedAt + lifetimeMs - refreshMarginMs,
    // Between refreshAt and expiresAt the token is still served while a refresh is attempted.
    expiresAt: startedAt + lifetimeMs - refreshMarginMs / 2,
  };
}

/**
 * Supplies the instrumented `fetch` to cache lookups. The caches are module-level and cannot hold the injected
 * `HttpClient`, so each call provides it.
 */
class AppIdentityFetch extends Context.Service<AppIdentityFetch, CustomFetch>()('AppIdentityFetch') {}

/** Fetches the issuer's OIDC discovery document using the identity's client authentication. */
async function discoverConfiguration(key: IdentityKey, fetch: CustomFetch): Promise<Configuration> {
  const issuer = new URL(key.issuer);
  const clientId = Redacted.value(key.clientId);
  const clientAuthentication = ClientSecretPost(Redacted.value(key.clientSecret));

  return await discovery(issuer, clientId, undefined, clientAuthentication, { [customFetch]: fetch, timeout: 10 });
}

/** OIDC discovery metadata per identity, kept for {@link CONFIGURATION_TTL_MS}. Failures are not cached. */
const configurations = Effect.runSync(
  Cache.makeWith(
    (key: IdentityKey) =>
      Effect.gen(function* () {
        const fetch = yield* AppIdentityFetch;

        return yield* Effect.tryPromise({
          try: async () => await discoverConfiguration(key, fetch),
          catch: fetchFailedError,
        });
      }),
    { capacity: CACHE_CAPACITY, timeToLive: (exit) => (Exit.isSuccess(exit) ? CONFIGURATION_TTL_MS : 0), requireServicesAt: 'lookup' },
  ),
);

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
 * Obtains a fresh, validated token: discovers the endpoint (cached), requests the token, then checks the response
 * and that the token is still usable once the request has finished. A failed token request drops the cached
 * discovery config so the endpoint is rediscovered next time.
 */
const acquireToken = (key: IdentityKey) =>
  Effect.gen(function* () {
    const fetch = yield* AppIdentityFetch;
    const cached = yield* Cache.get(configurations, key);
    const configuration = bindFetch(cached, key, fetch);
    const startedAt = nowMs();
    const response = yield* Effect.tryPromise({
      try: async () => await clientCredentialsGrant(configuration, { scope: key.scope }),
      catch: fetchFailedError,
    }).pipe(Effect.tapError(() => Cache.invalidate(configurations, key)));

    if (!isUsableTokenResponse(response)) {
      return yield* Effect.fail(new AppIdentityError('App identity token response is invalid.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE));
    }

    const token = toAccessToken(response, startedAt);

    if (!Number.isFinite(token.expiresAt) || token.expiresAt <= nowMs()) {
      return yield* Effect.fail(tokenExpiredError());
    }

    return token;
  });

/**
 * Runs token requests, sharing one in-flight request per identity (cold acquisition and refresh alike).
 * Successes are not kept (TTL 0, they are stored in `tokens`); failures are kept for {@link FAILURE_TTL_MS}.
 */
const acquisitions = Effect.runSync(Cache.makeWith(acquireToken, { capacity: CACHE_CAPACITY, timeToLive: (exit) => (Exit.isSuccess(exit) ? 0 : FAILURE_TTL_MS), requireServicesAt: 'lookup' }));

/**
 * Tokens served to callers, kept until their hard `expiresAt` (the TTL is the remaining lifetime). The refresh point
 * is not part of the TTL, so a token past `refreshAt` stays available while its replacement is fetched.
 */
const tokens = Effect.runSync(
  Cache.makeWith((key: IdentityKey) => Cache.get(acquisitions, key), {
    capacity: CACHE_CAPACITY,
    timeToLive: (exit) => (Exit.isSuccess(exit) ? Math.max(0, exit.value.expiresAt - nowMs()) : 0),
    requireServicesAt: 'lookup',
  }),
);

/** Empties all caches. For tests only: the caches live for the whole process. */
export async function clearAppIdentityCaches(): Promise<void> {
  await Effect.runPromise(Effect.all([Cache.invalidateAll(configurations), Cache.invalidateAll(acquisitions), Cache.invalidateAll(tokens)]));
}

/**
 * Issues OAuth client-credentials access tokens and keeps calls to the issuer to a minimum, since this is called
 * for every document upload. Three layered module-level caches, all keyed by {@link IdentityKey}: `configurations`,
 * `acquisitions` and `tokens`. A token past its refresh point is still served while one background refresh replaces
 * it, so callers do not wait on the issuer.
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
   * A valid cached token is returned immediately. If it is past its refresh point, a single background refresh is
   * started and the current token is still returned. Only a cold or fully expired entry waits on the issuer.
   *
   * @throws An application error if the request is invalid, the token cannot be acquired, or it has expired.
   */
  @Traced()
  async getAccessToken(request: GetAccessTokenRequest): Promise<Redacted.Redacted<string>> {
    assertValidRequest(request);

    const key = new IdentityKey(request);
    const result = await Effect.runPromise(this.withFetch(Effect.result(Cache.get(tokens, key))));

    if (Result.isFailure(result)) {
      throwAppError(result.failure.message, result.failure.errorCode);
    }

    const token = result.success;
    const now = nowMs();

    if (token.expiresAt <= now) {
      throwAppError('App identity token expired before use.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);
    }

    if (token.refreshAt <= now) {
      this.refreshInBackground(key);
    }

    return token.value;
  }

  /** Provides this client's `fetch` to an effect that reads or fills the caches. */
  private withFetch<A, E>(effect: Effect.Effect<A, E, AppIdentityFetch>): Effect.Effect<A, E> {
    return Effect.provideService(effect, AppIdentityFetch, this.fetch);
  }

  /**
   * Replaces a token that is still valid but past its refresh point without making callers wait.
   * A failed refresh leaves the current token in place until it really expires.
   */
  private refreshInBackground(key: IdentityKey): void {
    const refresh = Effect.gen(function* () {
      const current = yield* Cache.getOption(tokens, key);

      // Skip when the entry is gone (the next caller acquires cold) or another caller already installed a fresh token.
      if (Option.isNone(current) || current.value.refreshAt > nowMs()) {
        return;
      }

      const token = yield* Cache.get(acquisitions, key);
      yield* Cache.set(tokens, key, token);
    }).pipe(Effect.ignore);

    void Effect.runPromise(this.withFetch(refresh));
  }

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
