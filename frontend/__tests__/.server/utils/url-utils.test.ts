import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '~/.server/utils/env-utils';
import { getCdcpWebsiteApplyUrl, getCdcpWebsiteStatusUrl, getCdcpWebsiteUrl } from '~/.server/utils/url-utils';

// Mock the getEnv function
vi.mock('~/.server/utils/env-utils', () => ({
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
