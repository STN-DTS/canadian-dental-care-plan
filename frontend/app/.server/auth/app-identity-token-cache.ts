import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { Cache, Context, Data, Effect, Exit, Option, Result } from 'effect';
import type { Redacted } from 'effect';
import { inject, injectable } from 'inversify';

import type { GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import type { AppIdentityTokenCacheConfig } from '~/.server/auth/app-identity-token-cache-config';
import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import { throwAppError } from '~/.server/utils/error-utils';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { nowMs } from '~/utils/date-utils';

const log = createLogger('AppIdentityTokenCache');

/**
 * Cache key for one app identity: issuer, credentials, scope.
 *
 * Same identity = same key, so callers share one token. Any change (e.g. rotated secret) = new key.
 */
export class IdentityKey extends Data.Class<{
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

/**
 * A token as the issuer returned it, before the cache applies its deadlines.
 */
export interface IssuedToken {
  /**
   * The bearer token, redacted so it is not exposed by logging or inspection.
   */
  readonly value: Redacted.Redacted<string>;

  /**
   * Epoch milliseconds just before the token request was sent. The token's lifetime counts from here.
   */
  readonly requestedAt: number;

  /**
   * How long the issuer says the token is valid, in milliseconds. Must be greater than zero.
   */
  readonly lifetimeMs: number;
}

/**
 * Requests a new token from the issuer.
 *
 * Failures must be an `AppError` whose message is safe to surface: transport and parser errors can contain
 * credentials or response bodies.
 */
export type AcquireToken = (key: IdentityKey) => Effect.Effect<IssuedToken, AppError>;

/**
 * App identity access token cache. Tokens are needed on every document upload, so this keeps calls to the issuer to a minimum.
 *
 * It does not know how a token is obtained. Callers pass an {@link AcquireToken} function that does the request.
 *
 * Two layers, both keyed by {@link IdentityKey}:
 * - `acquisitions`: token requests. Concurrent callers share one request, and a failure is remembered briefly.
 * - `tokens`: tokens served to callers. A token past its refresh point is still served while one background refresh replaces it.
 *
 * Each instance owns its caches, so callers that must share tokens have to share the instance. The container binds it as a singleton.
 */
@injectable()
export class AppIdentityTokenCache {
  private readonly acquisitions: AccessTokenCache;
  private readonly tokens: AccessTokenCache;

  constructor(@inject(TYPES.AppIdentityTokenCacheConfig) config: AppIdentityTokenCacheConfig) {
    this.acquisitions = createAcquisitionCache(config);
    this.tokens = createTokenCache(config, this.acquisitions);
  }

  /**
   * Returns a bearer token for the given identity, from cache whenever possible.
   *
   * A valid cached token is returned immediately. If it is past its refresh point, one background refresh starts and
   * the current token is still returned. Only a cold or fully expired entry waits on the issuer.
   *
   * @param request A request that has already been validated.
   * @param acquire Requests a new token when the cache needs one, including for the background refresh.
   * @throws An application error if the token cannot be acquired or has expired.
   */
  async getAccessToken(request: GetAccessTokenRequest, acquire: AcquireToken): Promise<Redacted.Redacted<string>> {
    const key = new IdentityKey(request);
    const result = await Effect.runPromise(Effect.provideService(Effect.result(Cache.get(this.tokens, key)), TokenSource, acquire));

    if (Result.isFailure(result)) {
      throwAppError(result.failure.message, result.failure.errorCode);
    }

    const token = result.success;
    const now = nowMs();

    if (token.expiresAt <= now) {
      throwAppError(tokenExpiredError().message, ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);
    }

    if (token.refreshAt <= now) {
      this.refreshInBackground(key, acquire);
    }

    return token.value;
  }

  /**
   * Replaces a token that is still valid but past its refresh point without making callers wait.
   * A failed refresh leaves the current token in place until it really expires.
   */
  private refreshInBackground(key: IdentityKey, acquire: AcquireToken): void {
    const { tokens, acquisitions } = this;

    const refresh = Effect.gen(function* () {
      const current = yield* Cache.getOption(tokens, key);

      // Skip when the entry is gone (the next caller acquires cold) or another caller already installed a fresh token.
      if (Option.isNone(current) || current.value.refreshAt > nowMs()) {
        return;
      }

      // Skip while a refresh is in flight or its failure is still remembered, so callers neither repeat the work nor the warning.
      if (yield* Cache.has(acquisitions, key)) {
        return;
      }

      const token = yield* Cache.get(acquisitions, key);
      yield* Cache.set(tokens, key, token);
    }).pipe(
      Effect.tapError(() =>
        Effect.sync(() => {
          log.warn('App identity token refresh failed; serving the current token until it expires', { [ATTR_ERROR_TYPE]: 'app_identity_token_refresh_failed' });
        }),
      ),
      Effect.ignoreCause,
    );

    void Effect.runPromise(Effect.provideService(refresh, TokenSource, acquire));
  }
}

/** A cached access token and the two deadlines that govern how it is used (epoch milliseconds). */
interface AccessToken {
  readonly value: Redacted.Redacted<string>;
  /** After this instant the token is served while a background refresh runs. */
  readonly refreshAt: number;
  /** After this instant the token must never be returned. */
  readonly expiresAt: number;
}

type AccessTokenCache = Cache.Cache<IdentityKey, AccessToken, AppError, TokenSource>;

/** Supplies the caller's {@link AcquireToken} to cache lookups. The cache cannot hold it, so each call provides it. */
class TokenSource extends Context.Service<TokenSource, AcquireToken>()('AppIdentityTokenSource') {}

/**
 * Runs token requests, sharing one in-flight request per identity (cold acquisition and refresh alike).
 * Successes are not kept (TTL 0, they are stored in the token cache); failures are kept for `failureTtlMs`.
 */
function createAcquisitionCache(config: AppIdentityTokenCacheConfig): AccessTokenCache {
  return Effect.runSync(
    Cache.makeWith((key: IdentityKey) => acquireToken(key, config), {
      capacity: config.capacity,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? 0 : config.failureTtlMs),
      requireServicesAt: 'lookup',
    }),
  );
}

/**
 * Tokens served to callers, kept until their hard `expiresAt` (the TTL is the remaining lifetime). The refresh point
 * is not part of the TTL, so a token past `refreshAt` stays available while its replacement is fetched.
 */
function createTokenCache(config: AppIdentityTokenCacheConfig, acquisitions: AccessTokenCache): AccessTokenCache {
  return Effect.runSync(
    Cache.makeWith((key: IdentityKey) => Cache.get(acquisitions, key), {
      capacity: config.capacity,
      timeToLive: (exit) => (Exit.isSuccess(exit) ? Math.max(0, exit.value.expiresAt - nowMs()) : 0),
      requireServicesAt: 'lookup',
    }),
  );
}

/** The issued token's usable lifetime had already elapsed (for example, a very slow token request). */
function tokenExpiredError(): AppError {
  return new AppError('App identity token expired before use.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_TOKEN_EXPIRED);
}

/** Requests a token, then rejects it if its usable lifetime already elapsed while the request ran. */
function acquireToken(key: IdentityKey, config: AppIdentityTokenCacheConfig): Effect.Effect<AccessToken, AppError, TokenSource> {
  return Effect.gen(function* () {
    const acquire = yield* TokenSource;
    log.debug('Requesting app identity token');
    const token = toAccessToken(yield* acquireSafely(acquire, key), config);

    if (!Number.isFinite(token.expiresAt) || token.expiresAt <= nowMs()) {
      return yield* Effect.fail(tokenExpiredError());
    }

    log.debug('App identity token acquired');

    return token;
  });
}

/**
 * Runs the injected acquire function so that only an `AppError` can come out. A defect (a throw, in the effect or
 * while building it) becomes a generic failure, since the raw error can contain credentials. The raw error is not
 * logged for the same reason, so the log records only that a defect happened.
 */
function acquireSafely(acquire: AcquireToken, key: IdentityKey): Effect.Effect<IssuedToken, AppError> {
  return Effect.suspend(() => acquire(key)).pipe(
    Effect.catchDefect(() => {
      log.error('Unexpected error while acquiring app identity token', { [ATTR_ERROR_TYPE]: 'unexpected_acquire_error' });

      return Effect.fail(new AppError('App identity token acquisition failed.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED));
    }),
  );
}

/**
 * Adds the two deadlines to an issued token, both measured from when the request started so that
 * request latency is subtracted from the token's usable lifetime.
 *
 * - `refreshAt`: lifetime minus the refresh margin (`refreshMarginRatio` of the lifetime, capped at `maxRefreshMarginMs`).
 * - `expiresAt`: lifetime minus half the refresh margin, a safety buffer so a returned token is still valid downstream.
 */
function toAccessToken({ value, requestedAt, lifetimeMs }: IssuedToken, config: AppIdentityTokenCacheConfig): AccessToken {
  const refreshMarginMs = Math.min(config.maxRefreshMarginMs, lifetimeMs * config.refreshMarginRatio);

  return {
    value,
    refreshAt: requestedAt + lifetimeMs - refreshMarginMs,
    // Between refreshAt and expiresAt the token is still served while a refresh is attempted.
    expiresAt: requestedAt + lifetimeMs - refreshMarginMs / 2,
  };
}
