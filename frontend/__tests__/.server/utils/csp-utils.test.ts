import { afterEach, describe, expect, it, vi } from 'vitest';

import { adobeAnalyticsCSP, generateContentSecurityPolicy, hcaptchaCSP } from '~/.server/utils/csp-utils';
import { getEnv } from '~/.server/utils/env-utils';

vi.mock('~/.server/utils/env-utils');

describe('csp-utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContentSecurityPolicy', () => {
    it('should generate a strict CSP', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'production' });

      const nonce = '1234567890ABCDEF';
      const csp = generateContentSecurityPolicy(nonce);

      expect(csp).toContain(`base-uri 'none';`);
      expect(csp).toContain(`default-src 'none';`);
      expect(csp).toContain(`connect-src 'self' ${hcaptchaCSP.connectSrc} ${adobeAnalyticsCSP.connectSrc};`);
      expect(csp).toContain(`font-src 'self' fonts.gstatic.com;`);
      expect(csp).toContain(`frame-src 'self' ${hcaptchaCSP.frameSrc} ${adobeAnalyticsCSP.frameSrc};`);
      expect(csp).toContain(`img-src 'self' data: ${adobeAnalyticsCSP.imgSrc} https://purecatamphetamine.github.io;`);
      expect(csp).toContain(`script-src 'self' 'unsafe-inline' ${hcaptchaCSP.scriptSrc} ${adobeAnalyticsCSP.scriptSrc}`);
      expect(csp).toContain(`style-src 'self' 'unsafe-inline' ${hcaptchaCSP.styleSrc}`);
    });

    it('should allow HMR websocket connections when NODE_ENV=development', () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ NODE_ENV: 'development' });

      const nonce = '1234567890ABCDEF';
      const csp = generateContentSecurityPolicy(nonce);

      expect(csp).toContain(`connect-src 'self' ${hcaptchaCSP.connectSrc} ${adobeAnalyticsCSP.connectSrc} ws://localhost:3001;`);
    });
  });
});
