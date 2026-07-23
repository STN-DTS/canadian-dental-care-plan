import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '~/.server/utils/env-utils';
import { getClientIpAddress } from '~/.server/utils/ip-address-utils';

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn(),
}));

describe('ip-address-utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getClientIpAddress()', () => {
    it('should return first IP from "X-Forwarded-For" header', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'production' });
      const request = new Request('https://example.com', {
        headers: { 'X-Forwarded-For': '1.2.3.4, 5.6.7.8' },
      });
      expect(getClientIpAddress(request)).toEqual('1.2.3.4');
    });

    it('should return null if missing "X-Forwarded-For" header', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'production' });
      const request = new Request('https://example.com');
      expect(getClientIpAddress(request)).toBeNull();
    });

    it('should trim whitespace from first IP address', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'production' });
      const request = new Request('https://example.com', {
        headers: { 'X-Forwarded-For': '    1.2.3.4    , 5.6.7.8' },
      });
      expect(getClientIpAddress(request)).toEqual('1.2.3.4');
    });

    it('should return "172.0.0.1" when NODE_ENV=development', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'development' });
      const request = new Request('https://example.com', {});
      expect(getClientIpAddress(request)).toEqual('127.0.0.1');
    });
  });
});
