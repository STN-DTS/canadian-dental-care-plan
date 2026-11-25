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
    vi.stubEnv('INTEROP_APPLICANT_SUBSCRIPTION_KEY', '  applicant-key  ');
    vi.stubEnv('INTEROP_CCT_SUBSCRIPTION_KEY', '  ');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_PROVIDER', 'mock');
    vi.stubEnv('ENABLED_MOCKS', '');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER', '');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID', '');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET', '');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE', '');
  });

  afterEach(() => {
    deleteSingleton('serverEnv');
    vi.unstubAllEnvs();
  });

  it('keeps parsed secrets wrapped after validation, including defaults and optional keys', () => {
    const config = getEnv();

    expect(Redacted.isRedacted(config.INTEROP_API_SUBSCRIPTION_KEY)).toBe(true);
    expect(Redacted.value(config.INTEROP_API_SUBSCRIPTION_KEY)).toBe('subscription-key');
    assert(config.INTEROP_APPLICANT_SUBSCRIPTION_KEY);
    expect(Redacted.value(config.INTEROP_APPLICANT_SUBSCRIPTION_KEY)).toBe('applicant-key');
    expect(config.INTEROP_CCT_SUBSCRIPTION_KEY).toBeUndefined();
    expect(Redacted.isRedacted(config.SESSION_COOKIE_SECRET)).toBe(true);
    expect(Redacted.isRedacted(config.HCAPTCHA_SECRET_KEY)).toBe(true);
    expect(Redacted.isRedacted(config.AUTH_JWT_PRIVATE_KEY)).toBe(true);
    expect(Redacted.isRedacted(config.GC_NOTIFY_API_KEY)).toBe(true);
  });

  it('uses the default app identity token cache settings when none are configured', () => {
    expect(getEnv()).toMatchObject({
      APP_IDENTITY_TOKEN_CACHE_CAPACITY: 100,
      APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS: 5000,
      APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO: 0.1,
      APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS: 300_000,
      APP_IDENTITY_DISCOVERY_CACHE_CAPACITY: 100,
      APP_IDENTITY_DISCOVERY_CACHE_TTL_MS: 3_600_000,
    });
  });

  it('uses bounded defaults for lookup cache sizes', () => {
    const cacheSizes = {
      LOOKUP_SVC_APPLICATION_YEAR_CACHE_MAX_SIZE: 10,
      LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_MAX_SIZE: 1000,
      LOOKUP_SVC_CLIENT_FRIENDLY_STATUS_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_COUNTRY_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_DOCUMENT_UPLOAD_REASON_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_FEDERAL_GOVERNMENT_INSURANCE_PLAN_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_LETTER_TYPE_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_PROVINCE_TERRITORY_STATE_CACHE_MAX_SIZE: 500,
      LOOKUP_SVC_PROVINCIAL_GOVERNMENT_INSURANCE_PLAN_CACHE_MAX_SIZE: 500,
    } as const;

    for (const name of Object.keys(cacheSizes)) {
      vi.stubEnv(name, undefined);
    }

    expect(getEnv()).toMatchObject(cacheSizes);
  });

  it('reads the app identity token cache settings from the environment', () => {
    vi.stubEnv('APP_IDENTITY_TOKEN_CACHE_CAPACITY', '10');
    vi.stubEnv('APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS', '0');
    vi.stubEnv('APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO', '0.25');
    vi.stubEnv('APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS', '30000');
    vi.stubEnv('APP_IDENTITY_DISCOVERY_CACHE_CAPACITY', '20');
    vi.stubEnv('APP_IDENTITY_DISCOVERY_CACHE_TTL_MS', '600000');

    expect(getEnv()).toMatchObject({
      APP_IDENTITY_TOKEN_CACHE_CAPACITY: 10,
      APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS: 0,
      APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO: 0.25,
      APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS: 30_000,
      APP_IDENTITY_DISCOVERY_CACHE_CAPACITY: 20,
      APP_IDENTITY_DISCOVERY_CACHE_TTL_MS: 600_000,
    });
  });

  it.each([
    ['APP_IDENTITY_TOKEN_CACHE_CAPACITY', '0'],
    ['APP_IDENTITY_TOKEN_CACHE_CAPACITY', '1.5'],
    ['APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS', '-1'],
    ['APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO', '0'],
    ['APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO', '1'],
    ['APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO', 'abc'],
    ['APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS', '-5'],
    ['APP_IDENTITY_DISCOVERY_CACHE_CAPACITY', '0'],
    ['APP_IDENTITY_DISCOVERY_CACHE_TTL_MS', '0'],
  ])('rejects %s=%s', (name, value) => {
    vi.stubEnv(name, value);

    expect(() => getEnv()).toThrow('Invalid application configuration');
  });

  it('defaults the Other evidentiary document type code to 998', () => {
    vi.stubEnv('EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER', undefined);

    expect(getEnv().EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER).toBe('998');
  });

  it('keeps the Other evidentiary document type code as a trimmed string with leading zeros', () => {
    vi.stubEnv('EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER', ' 0998 ');

    expect(getEnv().EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER).toBe('0998');
  });

  it('rejects a blank Other evidentiary document type code', () => {
    vi.stubEnv('EVIDENTIARY_DOCUMENT_TYPE_CODE_OTHER', '  ');

    expect(() => getEnv()).toThrow('Invalid application configuration');
  });

  it('uses the mock document upload provider independently of other service mocks', () => {
    vi.stubEnv('ENABLED_MOCKS', 'cct,code-tables');

    const config = getEnv();
    expect(config.INTEROP_DOCUMENT_UPLOAD_PROVIDER).toBe('mock');
    expect(config.ENABLED_MOCKS).toEqual(['cct', 'code-tables']);
  });

  it('rejects document-upload in ENABLED_MOCKS', () => {
    vi.stubEnv('ENABLED_MOCKS', 'cct,document-upload');

    expect(() => getEnv()).toThrow('ENABLED_MOCKS');
  });

  it('uses the default document upload provider independently of other service mocks', () => {
    configureDefault();
    vi.stubEnv('ENABLED_MOCKS', 'cct');

    const config = getEnv();
    expect(config.INTEROP_DOCUMENT_UPLOAD_PROVIDER).toBe('default');
    expect(config.ENABLED_MOCKS).toEqual(['cct']);
  });

  it('defaults to the real provider when no provider is configured', () => {
    configureDefault();
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_PROVIDER', '');

    expect(getEnv().INTEROP_DOCUMENT_UPLOAD_PROVIDER).toBe('default');
  });

  it('rejects a missing EWDU password for the default provider', () => {
    configureDefault();
    vi.stubEnv('EWDU_ENCAPSULATION_PASSWORD', '');

    expect(() => getEnv()).toThrow('Invalid application configuration');
  });

  it('rejects a whitespace-only OAuth secret for the default provider', () => {
    configureDefault();
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET', '   ');

    expect(() => getEnv()).toThrow('Invalid application configuration');
  });

  it.each(['INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER', 'INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID', 'INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET', 'INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE'] as const)(
    'rejects missing %s for the default provider at startup',
    (key) => {
      configureDefault();
      vi.stubEnv(key, '');
      expect(() => getEnv()).toThrow('Invalid application configuration');
    },
  );

  it.each(['https://identity.example.test', 'https://identity.example.test/organization'])('accepts issuer %s and keeps the OAuth secret redacted without changing its value', (issuer) => {
    configureDefault();
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER', ` ${issuer} `);
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID', ' client-id ');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET', ' secret +&= ');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE', ' documents.write ');

    const config = getEnv();
    assert(config.INTEROP_DOCUMENT_UPLOAD_PROVIDER === 'default');
    expect(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER).toBe(issuer);
    expect(Redacted.value(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID)).toBe('client-id');
    expect(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE).toBe('documents.write');
    assert(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET);
    expect(Redacted.isRedacted(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET)).toBe(true);
    expect(Redacted.value(config.INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET)).toBe(' secret +&= ');
    expect(JSON.stringify(config)).not.toContain('secret +&=');
  });

  it.each([
    '../identity',
    'identity.example.test',
    'http://identity.example.test',
    'https://user:password@identity.example.test',
    'https://identity.example.test?query=value',
    'https://identity.example.test#fragment',
    'https://identity.example.test?',
    'https://identity.example.test#',
    'https://identity.example.test/.well-known/openid-configuration',
  ])('rejects unsafe or non-issuer URL %s', (issuer) => {
    configureDefault();
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER', issuer);
    expect(() => getEnv()).toThrow('Invalid application configuration');
  });
});

function configureDefault() {
  vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_PROVIDER', 'default');
  vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_ISSUER', 'https://identity.example.test');
  vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_ID', 'client-id');
  vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_CLIENT_SECRET', 'client-secret');
  vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_OAUTH_SCOPE', 'documents.write');
  vi.stubEnv('EWDU_ENCAPSULATION_PASSWORD', 'password');
}

describe('getEnv auth provider', () => {
  const oidcPrivateKey = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey;

  beforeEach(() => {
    deleteSingleton('serverEnv');
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('INTEROP_API_BASE_URI', 'https://interop.example.test');
    vi.stubEnv('INTEROP_API_SUBSCRIPTION_KEY', 'subscription-key');
    vi.stubEnv('AUTH_JWT_PRIVATE_KEY', privateKey.toString('base64'));
    vi.stubEnv('AUTH_JWT_PUBLIC_KEY', publicKey.toString('base64'));
    vi.stubEnv('AUTH_LOGOUT_REDIRECT_URL', 'https://auth.example.test/logout');
    vi.stubEnv('AUTH_RAOIDC_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('AUTH_RAOIDC_CLIENT_ID', 'client-id');
    vi.stubEnv('AUTH_RASCL_LOGOUT_URL', 'https://auth.example.test/signout');
    vi.stubEnv('GC_NOTIFY_API_KEY', 'notify-key');
    vi.stubEnv('INTEROP_DOCUMENT_UPLOAD_PROVIDER', 'mock');
    vi.stubEnv('ENABLED_MOCKS', '');
    vi.stubEnv('AUTH_PROVIDER', '');
  });

  afterEach(() => {
    deleteSingleton('serverEnv');
    vi.unstubAllEnvs();
  });

  function configureOidc() {
    vi.stubEnv('AUTH_PROVIDER', 'oidc');
    vi.stubEnv('AUTH_RAOIDC_BASE_URL', '');
    vi.stubEnv('AUTH_RAOIDC_CLIENT_ID', '');
    vi.stubEnv('AUTH_OIDC_ISSUER_URL', 'https://isams.example.test/oauth2');
    vi.stubEnv('AUTH_OIDC_CLIENT_ID', 'isams-client');
    vi.stubEnv('AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc');
    vi.stubEnv('AUTH_OIDC_PRIVATE_KEY', oidcPrivateKey);
    vi.stubEnv('AUTH_OIDC_PRIVATE_KEY_ID', 'cdcp-isams-test');
  }

  it('defaults to RAOIDC and keeps its settings required', () => {
    expect(getEnv()).toMatchObject({ AUTH_PROVIDER: 'raoidc', AUTH_RAOIDC_BASE_URL: 'https://auth.example.test', AUTH_RAOIDC_CLIENT_ID: 'client-id' });

    deleteSingleton('serverEnv');
    vi.stubEnv('AUTH_RAOIDC_CLIENT_ID', '');
    expect(() => getEnv()).toThrow('Invalid application configuration');
  });

  it('accepts the OIDC provider without RAOIDC settings and keeps the private key redacted', () => {
    configureOidc();

    const config = getEnv();
    assert(config.AUTH_PROVIDER === 'oidc');
    expect(config).toMatchObject({ AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: 'token-endpoint', AUTH_OIDC_CLIENT_ID: 'isams-client' });
    expect(config).not.toHaveProperty('AUTH_RAOIDC_BASE_URL');
    expect(Redacted.isRedacted(config.AUTH_OIDC_PRIVATE_KEY)).toBe(true);
    expect(JSON.stringify(config)).not.toContain('PRIVATE KEY');
  });

  it('drops RAOIDC settings when the OIDC provider is configured', () => {
    configureOidc();
    vi.stubEnv('AUTH_RAOIDC_BASE_URL', 'https://auth.example.test');
    vi.stubEnv('AUTH_RAOIDC_CLIENT_ID', 'client-id');

    const config = getEnv();

    expect(config).not.toHaveProperty('AUTH_RAOIDC_BASE_URL');
    expect(config).not.toHaveProperty('AUTH_RAOIDC_CLIENT_ID');
  });

  it.each(['https://cdcp-isams.dev-dp.dts-stn.com/auth/callback/oidc', 'http://localhost:3000/auth/callback/oidc'])('accepts the redirect URI %s', (redirectUri) => {
    configureOidc();
    vi.stubEnv('AUTH_OIDC_REDIRECT_URI', redirectUri);

    expect(getEnv()).toMatchObject({ AUTH_OIDC_REDIRECT_URI: redirectUri });
  });

  it('accepts the OIDC private key as single-line base64 PKCS#8', () => {
    configureOidc();
    vi.stubEnv('AUTH_OIDC_PRIVATE_KEY', privateKey.toString('base64'));

    expect(getEnv().AUTH_PROVIDER).toBe('oidc');
  });

  it.each([
    ['AUTH_OIDC_ISSUER_URL', 'http://isams.example.test/oauth2'],
    ['AUTH_OIDC_ISSUER_URL', 'https://isams.example.test/oauth2/.well-known/openid-configuration'],
    ['AUTH_OIDC_CLIENT_ID', ''],
    ['AUTH_OIDC_REDIRECT_URI', 'not-a-url'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/callback'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc/'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/raoidc'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc?env=test'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc?'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc#fragment'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://cdcp.example.test/auth/callback/oidc#'],
    ['AUTH_OIDC_REDIRECT_URI', 'https://user:pass@cdcp.example.test/auth/callback/oidc'],
    ['AUTH_OIDC_REDIRECT_URI', 'ftp://cdcp.example.test/auth/callback/oidc'],
    ['AUTH_OIDC_PRIVATE_KEY', 'not-a-key'],
    ['AUTH_OIDC_PRIVATE_KEY', generateKeyPairSync('ec', { namedCurve: 'P-256', privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey],
    ['AUTH_OIDC_PRIVATE_KEY_ID', ''],
    ['AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE', 'anything'],
    ['AUTH_PROVIDER', 'mock'],
  ])('rejects invalid %s (case %#)', (name, value) => {
    configureOidc();
    vi.stubEnv(name, value);

    expect(() => getEnv()).toThrow('Invalid application configuration');
  });
});
