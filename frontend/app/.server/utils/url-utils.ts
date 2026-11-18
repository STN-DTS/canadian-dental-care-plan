import { Result, Schema } from 'effect';

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

export class InvalidIssuerError extends Schema.TaggedError<InvalidIssuerError>()('InvalidIssuerError', {
  reason: Schema.String,
  input: Schema.String,
}) {}

/**
 * Validates an OAuth 2.0 Issuer URL according to RFC 8414.
 * Returns Result<URL, InvalidIssuerError>
 */
export function validateOAuthIssuer(input: string, options?: { readonly allowHttpLocalhost?: boolean }): Result.Result<URL, InvalidIssuerError> {
  return Result.try({
    try: () => new URL(input),
    catch: () => new InvalidIssuerError({ reason: 'Malformed URL string', input }),
  }).pipe(
    // Must use HTTPS (with an optional escape hatch for localhost testing)
    Result.filterOrFail(
      (url) => url.protocol === 'https:' || (Boolean(options?.allowHttpLocalhost) && url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')),
      () => new InvalidIssuerError({ reason: 'Issuer URL must use the https scheme', input }),
    ),
    // RFC 8414 Section 2: Must NOT contain query or fragment components
    Result.filterOrFail(
      (url) => url.search === '' && !input.includes('?'),
      () => new InvalidIssuerError({ reason: 'Issuer URL must not contain query components', input }),
    ),
    Result.filterOrFail(
      (url) => url.hash === '' && !input.includes('#'),
      () => new InvalidIssuerError({ reason: 'Issuer URL must not contain fragment components', input }),
    ),
    // Disallow embedded credentials
    Result.filterOrFail(
      (url) => url.username === '' && url.password === '',
      () => new InvalidIssuerError({ reason: 'Issuer URL must not contain user credentials', input }),
    ),
    Result.filterOrFail(
      (url) => !url.pathname.includes('/.well-known/'),
      () => new InvalidIssuerError({ reason: 'Issuer URL must not be a discovery-document URL', input }),
    ),
  );
}

/**
 * Appends a configured endpoint pathname to a base URI, keeping any path prefix in the base URI.
 * Placeholders such as `{clientId}` are kept so the result can be reported and later expanded with `expandPathParams`.
 */
export function buildEndpointUrl(baseUri: string | URL, pathname: string): string {
  return `${baseUri.toString().replace(/\/+$/, '')}${pathname}`;
}

/**
 * Replaces `{name}` placeholders in a URL template in a single pass; callers encode values as needed.
 * Unknown placeholders are left unchanged.
 */
export function expandPathParams(urlTemplate: string, pathParams: Readonly<Record<string, string>>): string {
  return urlTemplate.replaceAll(/\{(\w+)\}/g, (placeholder, name: string) => pathParams[name] ?? placeholder);
}
