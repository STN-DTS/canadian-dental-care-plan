import { Effect, Redacted } from 'effect';
import { inspect } from 'node:util';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GetAccessTokenRequest } from '~/.server/auth/app-identity-client';
import { clearTokenCaches, getCachedAccessToken } from '~/.server/auth/app-identity-token-cache';
import type { AcquireToken, IssuedToken } from '~/.server/auth/app-identity-token-cache';
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

describe('getCachedAccessToken', () => {
  beforeEach(async () => {
    await clearTokenCaches();
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z') });
  });

  afterEach(async () => {
    await clearTokenCaches();
  });

  it('converts a defect during a cold acquisition to a generic application error without leaking its message', async () => {
    const error = await captureError(getCachedAccessToken(request, dieWithSecret()));

    expect(error).toBeInstanceOf(AppError);
    expectGenericFailure(error);
  });

  it('converts an Effect.die value during a cold acquisition to a generic application error', async () => {
    const acquire: AcquireToken = () => Effect.die(new Error(SECRET_MESSAGE));

    const error = await captureError(getCachedAccessToken(request, acquire));

    expect(error).toBeInstanceOf(AppError);
    expectGenericFailure(error);
  });

  it('passes a typed application error from a cold acquisition through unchanged', async () => {
    const failure = new AppError('Invalid token response.', ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE);
    const acquire: AcquireToken = () => Effect.fail(failure);

    const error = await captureError(getCachedAccessToken(request, acquire));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ errorCode: ErrorCodes.AUTH_OIDC_APP_IDENTITY_INVALID_TOKEN_RESPONSE, message: failure.message });
  });

  it('keeps serving the old token without an unhandled rejection when a background refresh dies, until hard expiry', async () => {
    const unhandledRejection = vi.fn();
    process.on('unhandledRejection', unhandledRejection);

    try {
      const acquire = vi
        .fn<AcquireToken>()
        .mockReturnValueOnce(Effect.sync(() => issueToken('old-token')))
        .mockImplementation(() => Effect.sync(() => throwSecret()));

      expect(Redacted.value(await getCachedAccessToken(request, acquire))).toBe('old-token');

      await vi.advanceTimersByTimeAsync(REFRESH_AT_MS + 1);
      expect(Redacted.value(await getCachedAccessToken(request, acquire))).toBe('old-token');
      await flushBackgroundRefresh();

      expect(acquire).toHaveBeenCalledTimes(2);
      expect(unhandledRejection).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(EXPIRES_AT_MS - REFRESH_AT_MS - 2);
      expect(Redacted.value(await getCachedAccessToken(request, acquire))).toBe('old-token');
      await flushBackgroundRefresh();
      expect(unhandledRejection).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(1);
      const error = await captureError(getCachedAccessToken(request, acquire));

      expect(error).toBeInstanceOf(AppError);
      expectGenericFailure(error);
      await flushBackgroundRefresh();
      expect(unhandledRejection).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandledRejection);
    }
  });
});
