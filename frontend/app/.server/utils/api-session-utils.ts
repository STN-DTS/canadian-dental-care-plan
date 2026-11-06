import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_REDIRECT_TARGET } from '~/.server/logging/log-attributes';
import { getCdcpWebsiteApplyUrl, getCdcpWebsiteRenewUrl, getCdcpWebsiteStatusUrl, getCdcpWebsiteUrl } from '~/.server/utils/url-utils';
import type { ApiSessionRedirectTo } from '~/routes/api/session';

/**
 * Returns the appropriate URL based on the `redirectTo` parameter and the locale.
 *
 * @param redirectTo - A value indicating which URL to generate. Must be one of the `ApiSessionRedirectTo` values.
 * @param locale - The locale to use when generating the URL, should be one of the `AppLocale` values.
 * @returns The URL corresponding to the provided `redirectTo` value and locale.
 *
 * @example
 * ```
 * getApiSessionRedirectToUrl('cdcp-website', 'en'); // Returns the URL for the CDCP website in English
 * getApiSessionRedirectToUrl('cdcp-website-apply', 'fr'); // Returns the URL for the CDCP apply page in French
 * ```
 */
export function getApiSessionRedirectToUrl(redirectTo: ApiSessionRedirectTo, locale: AppLocale): string {
  const log = createLogger('api-session-utils/getApiSessionRedirectToUrl');

  switch (redirectTo) {
    case 'cdcp-website': {
      return getCdcpWebsiteUrl(locale);
    }

    case 'cdcp-website-apply': {
      return getCdcpWebsiteApplyUrl(locale);
    }

    case 'cdcp-website-renew': {
      return getCdcpWebsiteRenewUrl(locale);
    }

    case 'cdcp-website-status': {
      return getCdcpWebsiteStatusUrl(locale);
    }

    default: {
      log.warn('Invalid redirect target; using CDCP website fallback', { [ATTR_CDCP_REDIRECT_TARGET]: 'cdcp-website' });
      return getCdcpWebsiteUrl(locale);
    }
  }
}
