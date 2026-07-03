import type { LanguageDetectorModule } from 'i18next';
import { createInstance } from 'i18next';
import I18NextHttpBackend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

import { getClientEnv } from '~/utils/env-utils';
import type { RouteHandleData } from '~/utils/route-utils';

/**
 * A constant array representing the supported application locales.
 * `as const` ensures that the array is treated as a tuple of literal types `'en'` and `'fr'`.
 */
export const APP_LOCALES = ['en', 'fr'] as const;

/**
 * Checks if a given value is a valid application locale.
 *
 * @param value - The value to check, which can be of any type.
 * @returns `true` if the value is a valid `AppLocale`, otherwise `false`.
 *
 * @example
 * ```
 * isAppLocale('en'); // true
 * isAppLocale('fr'); // true
 * isAppLocale('es'); // false
 * isAppLocale(123);  // false
 * ```
 */
export function isAppLocale(value: unknown): value is AppLocale {
  if (typeof value !== 'string') return false;
  return APP_LOCALES.includes(value as AppLocale);
}

/**
 * Returns the alternate language for the given input language.
 * (ie: 'en' → 'fr'; 'fr' → 'en')
 */
export function getAltLanguage(language: string): AppLocale {
  switch (language) {
    case 'en': {
      return 'fr';
    }
    case 'fr': {
      return 'en';
    }
    default: {
      throw new Error(`Could not determine altLanguage for language: ${language}.`);
    }
  }
}

/**
 * Extracts the language code from a given resource.
 *
 * @param resource - The resource to extract the language from.
 * @returns The language code ('en' or 'fr') if found, otherwise undefined.
 * @throws {Error} If the language code cannot be determined.
 */
export function getLanguage(resource: URL | string): AppLocale {
  switch (true) {
    case resource instanceof URL: {
      return getLanguageFromPathname(resource.pathname);
    }

    default: {
      return getLanguageFromPathname(resource);
    }
  }
}

function getLanguageFromPathname(pathname: string): AppLocale {
  switch (true) {
    case pathname === '/en' || pathname.startsWith('/en/'): {
      return 'en';
    }

    case pathname === '/fr' || pathname.startsWith('/fr/'): {
      return 'fr';
    }

    default: {
      throw new Error(`Could not determine language for pathname: ${pathname}.`);
    }
  }
}

/**
 * Returns all namespaces required by the given routes by examining the route's i18nPreloadNamespace handle property.
 * @see https://remix.run/docs/en/main/route/handle
 */
export function getNamespaces(routes?: ({ handle?: unknown } | undefined)[]) {
  if (routes === undefined) {
    return [];
  }

  const namespaces = routes
    .map((route) => route?.handle as RouteHandleData | undefined)
    .flatMap((handle) => handle?.i18nPreloadNamespace)
    .filter((ns) => ns !== undefined);

  return [...new Set(namespaces)];
}

/**
 * Initializes the client instance of i18next.
 */
export async function initI18n(namespaces: ReadonlyArray<string>) {
  const { BUILD_REVISION, I18NEXT_DEBUG } = getClientEnv();
  const i18n = createInstance();

  const languageDetector = {
    type: 'languageDetector',
    detect: () => document.documentElement.lang,
  } satisfies LanguageDetectorModule;

  await i18n
    .use(initReactI18next)
    .use(languageDetector)
    .use(I18NextHttpBackend)
    .init({
      appendNamespaceToMissingKey: true,
      backend: { loadPath: `/api/locales/{{lng}}/{{ns}}?v=${BUILD_REVISION}` },
      debug: I18NEXT_DEBUG,
      defaultNS: 'common',
      fallbackLng: false,
      interpolation: { escapeValue: false },
      ns: namespaces,
      preload: APP_LOCALES,
      react: { useSuspense: false },
    });

  return i18n;
}

/**
 * Returns translation based off provided locale
 *
 * @returns either the english translation or the french translation.
 */
export function getNameByLanguage<T extends { nameEn: string; nameFr: string } | { nameEn?: string; nameFr?: string }>(language: string, obj: T): T extends { nameEn: infer N; nameFr: infer F } ? (typeof language extends 'fr' ? F : N) : never {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (language === 'fr' ? obj.nameFr : obj.nameEn) as any;
}

/**
 * Indiscriminately removes the language from a path.
 */
export function removeLanguageFromPath(path: string) {
  return path.replace(/^(\/en|\/fr)/, '');
}

/**
 * Determines the application locale based on the input string.
 *
 * @param locale - The locale string to evaluate.
 * @returns The application locale ('en' or 'fr').
 *
 * @example
 * // Returns 'en'
 * useAppLocale('en');
 *
 * @example
 * // Returns 'fr'
 * useAppLocale('fr');
 *
 * @example
 * // Returns 'en' for unsupported locale
 * useAppLocale('es');
 */
export function useAppLocale(locale: string): AppLocale {
  return locale === 'fr' ? 'fr' : 'en';
}
