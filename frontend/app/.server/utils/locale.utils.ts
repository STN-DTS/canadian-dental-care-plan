import type { Params } from 'react-router';

import type { Namespace } from 'i18next';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';

import { i18nResources } from '~/.server/i18n.resources';
import { createLogger } from '~/.server/logging';
import { getEnv } from '~/.server/utils/env.utils';
import { APP_LOCALES } from '~/utils/locale-utils';

/**
 * Returns a t function that defaults to the language resolved through the request.
 * @see https://www.i18next.com/overview/api#getfixedt
 */
export async function getFixedT<const N extends Namespace>(localeOrRequestUrl: AppLocale | URL, namespaces: N) {
  const locale = typeof localeOrRequestUrl === 'string' ? localeOrRequestUrl : getLocale(localeOrRequestUrl);
  const i18n = await initI18n(locale, namespaces);
  return i18n.getFixedT(locale, namespaces);
}

/**
 * Extracts and returns the locale from the provided request URL.
 *
 * This function analyzes the pathname of the given `requestUrl` to determine the locale. It supports
 * English (`'en'`) and French (`'fr'`). If the pathname does not start with `/en` or `/fr`, the function
 * defaults to English (`'en'`).
 *
 * @param requestUrl - The URL object from which to extract the locale.
 * @returns The detected locale, either `'en'` or `'fr'`. Defaults to `'en'` if no valid locale is found.
 */
export function getLocale(requestUrl: URL): AppLocale {
  const log = createLogger('locale-utils.server/getLocale');
  const { pathname } = requestUrl;

  if (pathname.startsWith('/en')) {
    log.debug('Locale [en] detected in URL; pathname: [%s]', pathname);
    return 'en';
  }

  if (pathname.startsWith('/fr')) {
    log.debug('Locale [fr] detected in URL; pathname: [%s]', pathname);
    return 'fr';
  }

  log.debug('No locale detected in URL; returning default [en]; pathname: [%s]', pathname);
  return 'en';
}

/**
 * Extracts and returns the locale from the provided parameters.
 *
 * This function checks the `lang` property in the given `params` object to determine the locale to use.
 * It supports English (`'en'`) and French (`'fr'`). If the `lang` property is not recognized or is
 * not provided, the function defaults to English (`'en'`).
 *
 * @param params - The parameters object containing the `lang` property.
 * @returns The detected locale, either `'en'` or `'fr'`. Defaults to `'en'` if no valid locale is found.
 */
export function getLocaleFromParams(params: Params): AppLocale {
  const log = createLogger('locale-utils.server/getLocaleFromParams');
  const lang = params.lang;

  if (lang === 'en') {
    log.debug("Locale [en] detected in 'lang' param; lang: [%s]", lang);
    return 'en';
  }

  if (lang === 'fr') {
    log.debug("Locale [fr] detected in 'lang' param; lang: [%s]", lang);
    return 'fr';
  }

  log.debug("No locale detected in 'lang' param; returning default [en]; lang: [%s]", lang);
  return 'en';
}

/**
 * Initializes the server instance of i18next.
 * @see https://www.i18next.com/overview/api#createinstance
 */
export async function initI18n<const N extends Namespace>(locale: string | undefined, namespaces: N) {
  const log = createLogger('locale-utils.server/initI18n');
  const { I18NEXT_DEBUG } = getEnv();
  const i18n = createInstance();

  await i18n.use(initReactI18next).init({
    appendNamespaceToMissingKey: true,
    debug: I18NEXT_DEBUG,
    defaultNS: 'common',
    fallbackLng: false,
    interpolation: { escapeValue: false },
    lng: locale,
    ns: namespaces,
    preload: APP_LOCALES,
    react: { useSuspense: false },
    resources: i18nResources,
  });

  log.debug('i18next initialization complete');
  return i18n;
}
