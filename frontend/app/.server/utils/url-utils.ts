import { getEnv } from '~/.server/utils/env-utils';

/**
 * Returns the URL for applying to the Canadian Dental Care Plan (CDCP) website
 * based on the provided locale from the public environment variables.
 *
 * @param locale - The application locale ('en' or 'fr').
 * @returns The URL for applying to the CDCP website.
 */
export function getCdcpWebsiteApplyUrl(locale: AppLocale) {
  const { CDCP_WEBSITE_APPLY_URL_EN, CDCP_WEBSITE_APPLY_URL_FR } = getEnv();
  return locale === 'fr' ? CDCP_WEBSITE_APPLY_URL_FR : CDCP_WEBSITE_APPLY_URL_EN;
}

/**
 * Returns the URL for renewing on the Canadian Dental Care Plan (CDCP) website
 * based on the provided locale from the public environment variables.
 *
 * @param locale - The application locale ('en' or 'fr').
 * @returns The URL for renewing on the CDCP website.
 */
export function getCdcpWebsiteRenewUrl(locale: AppLocale) {
  const { CDCP_WEBSITE_RENEW_URL_EN, CDCP_WEBSITE_RENEW_URL_FR } = getEnv();
  return locale === 'fr' ? CDCP_WEBSITE_RENEW_URL_FR : CDCP_WEBSITE_RENEW_URL_EN;
}

/**
 * Returns the URL for checking the status of an application on the CDCP website
 * based on the provided locale from the public environment variables.
 *
 * @param locale - The application locale ('en' or 'fr').
 * @returns The URL for checking the status of an application on the CDCP website.
 */
export function getCdcpWebsiteStatusUrl(locale: AppLocale) {
  const { CDCP_WEBSITE_STATUS_URL_EN, CDCP_WEBSITE_STATUS_URL_FR } = getEnv();
  return locale === 'fr' ? CDCP_WEBSITE_STATUS_URL_FR : CDCP_WEBSITE_STATUS_URL_EN;
}

/**
 * Returns the base URL of the CDCP website based on the provided locale from
 * the public environment variables.
 *
 * @param locale - The application locale ('en' or 'fr').
 * @returns The base URL of the CDCP website.
 */
export function getCdcpWebsiteUrl(locale: AppLocale) {
  const { CDCP_WEBSITE_URL_EN, CDCP_WEBSITE_URL_FR } = getEnv();
  return locale === 'fr' ? CDCP_WEBSITE_URL_FR : CDCP_WEBSITE_URL_EN;
}
