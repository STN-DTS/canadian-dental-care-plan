import { Result } from 'effect';
import { assert, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '~/.server/utils/env-utils';
import { InvalidIssuerError, buildEndpointUrl, expandPathParams, getCdcpWebsiteApplyUrl, getCdcpWebsiteStatusUrl, getCdcpWebsiteUrl, validateOAuthIssuer } from '~/.server/utils/url-utils';

// Mock the getEnv function
vi.mock(import('~/.server/utils/env-utils'), () => ({
  getEnv: vi.fn(),
}));

describe('CDCP Website URL functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCdcpWebsiteApplyUrl', () => {
    it('should return the French URL for apply when locale is "fr"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_APPLY_URL_EN: 'https://example.com/en/apply',
        CDCP_WEBSITE_APPLY_URL_FR: 'https://example.com/fr/apply',
      });

      const result = getCdcpWebsiteApplyUrl('fr');
      expect(result).toBe('https://example.com/fr/apply');
    });

    it('should return the English URL for apply when locale is "en"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_APPLY_URL_EN: 'https://example.com/en/apply',
        CDCP_WEBSITE_APPLY_URL_FR: 'https://example.com/fr/apply',
      });

      const result = getCdcpWebsiteApplyUrl('en');
      expect(result).toBe('https://example.com/en/apply');
    });
  });

  describe('getCdcpWebsiteStatusUrl', () => {
    it('should return the French URL for status when locale is "fr"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_STATUS_URL_EN: 'https://example.com/en/status',
        CDCP_WEBSITE_STATUS_URL_FR: 'https://example.com/fr/status',
      });

      const result = getCdcpWebsiteStatusUrl('fr');
      expect(result).toBe('https://example.com/fr/status');
    });

    it('should return the English URL for status when locale is "en"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_STATUS_URL_EN: 'https://example.com/en/status',
        CDCP_WEBSITE_STATUS_URL_FR: 'https://example.com/fr/status',
      });

      const result = getCdcpWebsiteStatusUrl('en');
      expect(result).toBe('https://example.com/en/status');
    });
  });

  describe('validateOAuthIssuer', () => {
    it.each([
      ['https://identity.example.test', 'https://identity.example.test/'],
      ['https://identity.example.test/tenant/v2.0', 'https://identity.example.test/tenant/v2.0'],
      ['HTTPS://IDENTITY.EXAMPLE.TEST:443/tenant%3Fpart%23section', 'https://identity.example.test/tenant%3Fpart%23section'],
    ])('returns a parsed URL for issuer %s', (input, expected) => {
      const result = validateOAuthIssuer(input);

      assert(Result.isSuccess(result));
      expect(result.success).toBeInstanceOf(URL);
      expect(result.success.href).toBe(expected);
    });

    it.each([
      ['http://localhost:3000/tenant', 'http://localhost:3000/tenant'],
      ['http://127.0.0.1:8080/tenant', 'http://127.0.0.1:8080/tenant'],
    ])('accepts %s when local HTTP is enabled', (input, expected) => {
      const result = validateOAuthIssuer(input, { allowHttpLocalhost: true });

      assert(Result.isSuccess(result));
      expect(result.success.href).toBe(expected);
    });

    it('rejects local HTTP when it is explicitly disabled', () => {
      const result = validateOAuthIssuer('http://localhost:3000', { allowHttpLocalhost: false });

      assert(Result.isFailure(result));
      expect(result.failure.reason).toContain('https');
    });

    it.each([
      ['', 'Malformed'],
      ['/relative', 'Malformed'],
      ['https://', 'Malformed'],
      ['http://identity.example.test', 'https'],
      ['http://localhost:3000/tenant', 'https'],
      ['http://127.0.0.1:8080/tenant', 'https'],
      ['ftp://identity.example.test', 'https'],
      ['https://identity.example.test?tenant=example', 'query'],
      ['https://identity.example.test?', 'query'],
      ['https://identity.example.test#section', 'fragment'],
      ['https://identity.example.test#', 'fragment'],
      ['https://user@identity.example.test', 'credentials'],
      ['https://:password@identity.example.test', 'credentials'],
      ['https://identity.example.test/.well-known/openid-configuration', 'discovery'],
    ])('returns a structured failure for issuer %s', (input, reason) => {
      const result = validateOAuthIssuer(input);

      assert(Result.isFailure(result));
      expect(result.failure).toBeInstanceOf(InvalidIssuerError);
      expect(result.failure).toMatchObject({ input, reason: expect.stringContaining(reason) });
    });

    it.each([
      ['http://identity.example.test', 'https'],
      ['http://localhost.example.test', 'https'],
      ['http://127.0.0.2:8080', 'https'],
      ['ftp://localhost:3000', 'https'],
      ['http://localhost:3000?', 'query'],
      ['http://localhost:3000#', 'fragment'],
      ['http://user:password@localhost:3000', 'credentials'],
    ])('still rejects %s when local HTTP is enabled', (input, reason) => {
      const result = validateOAuthIssuer(input, { allowHttpLocalhost: true });

      assert(Result.isFailure(result));
      expect(result.failure).toBeInstanceOf(InvalidIssuerError);
      expect(result.failure).toMatchObject({ input, reason: expect.stringContaining(reason) });
    });
  });

  describe('getCdcpWebsiteUrl', () => {
    it('should return the French base URL when locale is "fr"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_URL_EN: 'https://example.com/en',
        CDCP_WEBSITE_URL_FR: 'https://example.com/fr',
      });

      const result = getCdcpWebsiteUrl('fr');
      expect(result).toBe('https://example.com/fr');
    });

    it('should return the English base URL when locale is "en"', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({
        CDCP_WEBSITE_URL_EN: 'https://example.com/en',
        CDCP_WEBSITE_URL_FR: 'https://example.com/fr',
      });

      const result = getCdcpWebsiteUrl('en');
      expect(result).toBe('https://example.com/en');
    });
  });
});

describe('buildEndpointUrl', () => {
  it('keeps the base URI path prefix and trims its trailing slashes', () => {
    expect(buildEndpointUrl(new URL('https://api.example.test/uat/stream1/'), '/dental-care/status')).toBe('https://api.example.test/uat/stream1/dental-care/status');
  });

  it('keeps placeholders for later expansion', () => {
    expect(buildEndpointUrl('https://api.example.test', '/clients({clientId})')).toBe('https://api.example.test/clients({clientId})');
  });
});

describe('expandPathParams', () => {
  it('replaces placeholders in a single pass and leaves unknown placeholders', () => {
    expect(expandPathParams('https://api.example.test/clients({clientId})/{other}', { clientId: '{other}' })).toBe('https://api.example.test/clients({other})/{other}');
  });
});
