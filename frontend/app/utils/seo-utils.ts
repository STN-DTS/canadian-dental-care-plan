import { useLocation } from 'react-router';

import { APP_LOCALES, removeLanguageFromPath } from '~/utils/locale-utils';
import { normalizeSpaces } from '~/utils/string-utils';

/**
 * Custom hook to generate a canonical URL based on the current location and language.
 * @param origin - The origin URL. For more information on the origin URL, see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/origin}.
 * @returns The canonical URL.
 */
export function useCanonicalURL(origin: string) {
  const { pathname, search } = useLocation();

  const url = new URL(pathname, origin);
  url.search = new URLSearchParams(search).toString();

  return url.href;
}

/**
 * Custom hook to generate alternate language URLs based on the current location.
 * @param origin - The origin URL. For more information on the origin URL, see {@link https://developer.mozilla.org/en-US/docs/Web/API/URL/origin}.
 * @returns An array of objects containing the hreflang and href for alternate language URLs.
 */
export function useAlternateLanguages(origin: string, languages: ReadonlyArray<AppLocale> = APP_LOCALES) {
  const { pathname, search } = useLocation();
  const pathWithoutLang = removeLanguageFromPath(pathname);

  return languages.map((lang) => {
    const url = new URL(`/${lang}${pathWithoutLang}`, origin);
    url.search = new URLSearchParams(search).toString();
    return { href: url.href, hrefLang: lang };
  });
}

/**
 * Generates meta tags for title.
 * @param title - The title to be included in meta tags.
 * @returns An array of meta tag objects.
 */
export function getTitleMetaTags(title: string, dcTermsTitle?: string) {
  const normalizedTitle = normalizeSpaces(title);
  const normalizedDcTermsTitle = dcTermsTitle ? normalizeSpaces(dcTermsTitle) : normalizedTitle;
  // prettier-ignore
  return [
    { title: normalizedTitle },
    { property: 'og:title', content: normalizedTitle },
    { property: 'dcterms.title', content: normalizedDcTermsTitle }
  ];
}

/**
 * Generates meta tags for description.
 * @param description - The description to be included in meta tags.
 * @returns An array of meta tag objects.
 */
export function getDescriptionMetaTags(description: string) {
  const normalizedDescription = normalizeSpaces(description);
  return [
    { name: 'description', content: normalizedDescription },
    { property: 'og:description', content: normalizedDescription },
  ];
}
