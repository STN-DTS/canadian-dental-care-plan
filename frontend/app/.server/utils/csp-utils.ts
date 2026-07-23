import { createLogger } from '~/.server/logging';
import { getEnv } from '~/.server/utils/env-utils';

export const adobeAnalyticsCSP = {
  connectSrc: 'https://*.demdex.net https://cm.everesttech.net https://assets.adobedtm.com https://*.omtrdc.net',
  frameSrc: 'https://*.demdex.net',
  imgSrc: 'https://*.demdex.net https://cm.everesttech.net https://assets.adobedtm.com https://*.omtrdc.net',
  scriptSrc: 'https://code.jquery.com https://*.demdex.net https://cm.everesttech.net https://assets.adobedtm.com',
} as const;

export const hcaptchaCSP = {
  connectSrc: 'https://hcaptcha.com https://*.hcaptcha.com',
  frameSrc: 'https://hcaptcha.com https://*.hcaptcha.com',
  scriptSrc: 'https://hcaptcha.com https://*.hcaptcha.com',
  styleSrc: 'https://hcaptcha.com https://*.hcaptcha.com',
} as const;

/**
 * Generate a strict content security policy.
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html
 */
export function generateContentSecurityPolicy(nonce: string) {
  const log = createLogger('csp-utils/generateContentSecurityPolicy');
  const { NODE_ENV } = getEnv();
  const isDevelopment = NODE_ENV === 'development';

  const contentSecurityPolicy = [
    // prettier-ignore
    `base-uri 'none'`,
    `default-src 'none'`,
    `connect-src 'self' ${hcaptchaCSP.connectSrc} ${adobeAnalyticsCSP.connectSrc}` + (isDevelopment ? ' ws://localhost:3001' : ''),
    `font-src 'self' fonts.gstatic.com`,
    `form-action 'self'`,
    `frame-ancestors 'self'`,
    `frame-src 'self' ${hcaptchaCSP.frameSrc} ${adobeAnalyticsCSP.frameSrc}`,
    `img-src 'self' data: ${adobeAnalyticsCSP.imgSrc} https://purecatamphetamine.github.io`,
    // unsafe-inline is required by Adobe Analytics 💩
    `script-src 'self' 'unsafe-inline' ${hcaptchaCSP.scriptSrc} ${adobeAnalyticsCSP.scriptSrc}`,
    // unsafe-inline is required by Radix Primitives 💩
    `style-src 'self' 'unsafe-inline' ${hcaptchaCSP.styleSrc}`,
  ].join('; ');

  log.trace(`Generated content security policy: [${contentSecurityPolicy}]`);
  return contentSecurityPolicy;
}
