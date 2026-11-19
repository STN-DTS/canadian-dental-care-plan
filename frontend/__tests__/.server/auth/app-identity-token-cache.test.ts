import { Effect, Redacted } from 'effect';
import { inspect } from 'node:util';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { AppIdentityTokenCache } from '~/.server/auth/app-identity-token-cache';
import type { AcquireToken, IssuedToken } from '~/.server/auth/app-identity-token-cache';
import { AppIdentityTokenCacheConfig } from '~/.server/auth/app-identity-token-cache-config';
import { appIdentityTokenCacheConfigSchema } from '~/.server/auth/app-identity-token-cache-config-schema';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

const request = {
  issuer: new URL('https://identity.example.test/organization'),
  clientId: Redacted.make('client-id'),
  clientSecret: Redacted.make('client-secret'),
  scope: 'documents.write',
} satisfies GetAccessTokenRequest;

const GENERIC_MESSAGE = 'App identity token acquisition failed.';
const SECRET_MESSAGE = 'secret-value response-body';
const LIFETIME_MS = 200_000;
const REFRESH_AT_MS = 180_000;
const EXPIRES_AT_MS = 190_000;

function createCache(env: Record<string, string> = {}): AppIdentityTokenCache {
  return new AppIdentityTokenCache(new AppIdentityTokenCacheConfig(appIdentityTokenCacheConfigSchema.parse(env)));
}

function requestFor(clientId: string): GetAccessTokenRequest {
  return { ...request, clientId: Redacted.make(clientId) };
}

function issueToken(value: string): IssuedToken {
  return { value: Redacted.make(value), requestedAt: Temporal.Now.instant().epochMilliseconds, lifetimeMs: LIFETIME_MS };
}

function dieWithSecret(): AcquireToken {
  return vi.fn(() => Effect.sync(() => throwSecret()));
}

function throwSecret(): never {
  throw new Error(SECRET_MESSAGE);
}

async function flushBackgroundRefresh(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
  await Promise.resolve();
  await Promise.resolve();
}

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  return undefined;
}

function expectGenericFailure(error: unknown): void {
  expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_FETCH_FAILED, message: GENERIC_MESSAGE });
  expect(inspect(error, { depth: null })).not.toContain(SECRET_MESSAGE);
}

describe('AppIdentityTokenCache', () => {
  let cache: AppIdentityTokenCache;

  beforeEach(() => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z') });
    cache = createCache();
  });

  it('converts a defect during a cold acquisition to a generic application error without leaking its message', async () => {
    const error = await captureError(cache.getAccessToken(request, dieWithSecret()));

    expect(error).toBeInstanceOf(AppError);
    expectGenericFailure(error);
  });

  it('converts an Effect.die value during a cold acquisition to a generic application error', async () => {
    const acquire: AcquireToken = () => Effect.die(new Error(SECRET_MESSAGE));

    const error = await captureError(cache.getAccessToken(request, acquire));

    expect(error).toBeInstanceOf(AppError);
    expectGenericFailure(error);
  });

  it('passes a typed application error from a cold acquisition through unchanged', async () => {
    const failure = new AppError('Invalid token response.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE);
    const acquire: AcquireToken = () => Effect.fail(failure);

    const error = await captureError(cache.getAccessToken(request, acquire));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE, message: failure.message });
  });

  it('uses the configured failure TTL to decide when a failed acquisition is retried', async () => {
    const failureTtlMs = 1_000;
    const configuredCache = createCache({ APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS: String(failureTtlMs) });
    const failure = new AppError('Invalid token response.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE);
    const acquire = vi
      .fn<AcquireToken>()
      .mockReturnValueOnce(Effect.fail(failure))
      .mockReturnValue(Effect.sync(() => issueToken('recovered-token')));

    await captureError(configuredCache.getAccessToken(request, acquire));
    await vi.advanceTimersByTimeAsync(failureTtlMs - 1);
    await captureError(configuredCache.getAccessToken(request, acquire));
    expect(acquire).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(1);
    expect(Redacted.value(await configuredCache.getAccessToken(request, acquire))).toBe('recovered-token');
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('starts the background refresh at the configured fraction of the token lifetime', async () => {
    const configuredCache = createCache({ APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO: '0.5' });
    const acquire = vi.fn<AcquireToken>(() => Effect.sync(() => issueToken('token')));
    await configuredCache.getAccessToken(request, acquire);

    // Margin is min(60s, 50% of 200s) = 60s, so the refresh point is 140s instead of the default 180s.
    await vi.advanceTimersByTimeAsync(140_001);
    await configuredCache.getAccessToken(request, acquire);
    await flushBackgroundRefresh();

    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('caps the refresh margin at the configured maximum', async () => {
    const configuredCache = createCache({ APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS: '5000' });
    const acquire = vi.fn<AcquireToken>(() => Effect.sync(() => issueToken('token')));
    await configuredCache.getAccessToken(request, acquire);

    // Margin is min(5s, 10% of 200s) = 5s, so the refresh point is 195s instead of the default 180s.
    await vi.advanceTimersByTimeAsync(REFRESH_AT_MS + 1);
    await configuredCache.getAccessToken(request, acquire);
    await flushBackgroundRefresh();
    expect(acquire).toHaveBeenCalledOnce();

    await vi.advanceTimersByTimeAsync(195_000 - REFRESH_AT_MS);
    await configuredCache.getAccessToken(request, acquire);
    await flushBackgroundRefresh();
    expect(acquire).toHaveBeenCalledTimes(2);
  });

  it('retains at most the configured number of identities in each cache', async () => {
    const configuredCache = createCache({ APP_IDENTITY_TOKEN_CACHE_CAPACITY: '1' });
    const acquire = vi.fn<AcquireToken>(() => Effect.sync(() => issueToken('token')));

    await configuredCache.getAccessToken(requestFor('first'), acquire);
    await configuredCache.getAccessToken(requestFor('second'), acquire);
    await configuredCache.getAccessToken(requestFor('first'), acquire);
    expect(acquire).toHaveBeenCalledTimes(3);

    const failing = vi.fn<AcquireToken>(() => Effect.fail(new AppError('Invalid token response.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE)));
    const failureCache = createCache({ APP_IDENTITY_TOKEN_CACHE_CAPACITY: '1' });

    await captureError(failureCache.getAccessToken(requestFor('first'), failing));
    await captureError(failureCache.getAccessToken(requestFor('second'), failing));
    await captureError(failureCache.getAccessToken(requestFor('first'), failing));
    expect(failing).toHaveBeenCalledTimes(3);
  });

  it('keeps serving the old token without an unhandled rejection when a background refresh dies, until hard expiry', async () => {
    const unhandledRejection = vi.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      const acquire = vi
        .fn<AcquireToken>()
        .mockReturnValueOnce(Effect.sync(() => issueToken('old-token')))
        .mockImplementation(() => Effect.sync(() => throwSecret()));

      expect(Redacted.value(await cache.getAccessToken(request, acquire))).toBe('old-token');

      await vi.advanceTimersByTimeAsync(REFRESH_AT_MS + 1);
      expect(Redacted.value(await cache.getAccessToken(request, acquire))).toBe('old-token');
      await flushBackgroundRefresh();

      expect(acquire).toHaveBeenCalledTimes(2);
      expect(unhandledRejection).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(EXPIRES_AT_MS - REFRESH_AT_MS - 2);
      expect(Redacted.value(await cache.getAccessToken(request, acquire))).toBe('old-token');
      await flushBackgroundRefresh();
      expect(unhandledRejection).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      const error = await captureError(cache.getAccessToken(request, acquire));

      expect(error).toBeInstanceOf(AppError);
      expectGenericFailure(error);
      await flushBackgroundRefresh();
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });
});
