import { Redacted } from 'effect';
import { generateKeyPairSync } from 'node:crypto';
import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
  publicKeyEncoding: { type: 'spki', format: 'der' },
});

describe('getEnv secret values', () => {
  beforeEach(() => {
    deleteSingleton('serverEnv');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTEROP_API_BASE_URI', 'https://interop.example.test');
    vi.stubEnv('INTEROP_API_SUBSCRIPTION_KEY', '  subscription-key  ');
    vi.stubEnv('AUTH_JWT_PRIVATE_KEY', privateKey.toString('base64'));
    vi.stubEnv('AUTH_JWT_PUBLIC_KEY', publicKey.toString('base64'));
    vi.stubEnv('AUTH_LOGOUT_REDIRECT_URL', 'https://auth.example.test/logout');
    vi.stubEnv('AUTH_RAOIDC_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('AUTH_RAOIDC_CLIENT_ID', 'client-id');
    vi.stubEnv('AUTH_RASCL_LOGOUT_URL', 'https://auth.example.test/signout');
    vi.stubEnv('GC_NOTIFY_API_KEY', 'notify-key');
    vi.stubEnv('INTEROP_APPLICANT_API_SUBSCRIPTION_KEY', '  applicant-key  ');
    vi.stubEnv('INTEROP_CCT_API_SUBSCRIPTION_KEY', '  ');
  });

  afterEach(() => {
    deleteSingleton('serverEnv');
    vi.unstubAllEnvs();
  });

  it('keeps parsed secrets wrapped after validation, including defaults and optional keys', () => {
    const config = getEnv();

    expect(Redacted.isRedacted(config.INTEROP_API_SUBSCRIPTION_KEY)).toBe(true);
    expect(Redacted.value(config.INTEROP_API_SUBSCRIPTION_KEY)).toBe('subscription-key');
    assert(config.INTEROP_APPLICANT_API_SUBSCRIPTION_KEY);
    expect(Redacted.value(config.INTEROP_APPLICANT_API_SUBSCRIPTION_KEY)).toBe('applicant-key');
    expect(config.INTEROP_CCT_API_SUBSCRIPTION_KEY).toBeUndefined();
    expect(Redacted.isRedacted(config.SESSION_COOKIE_SECRET)).toBe(true);
    expect(Redacted.isRedacted(config.HCAPTCHA_SECRET_KEY)).toBe(true);
    expect(Redacted.isRedacted(config.AUTH_JWT_PRIVATE_KEY)).toBe(true);
    expect(Redacted.isRedacted(config.GC_NOTIFY_API_KEY)).toBe(true);
  });
});
