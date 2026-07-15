import { describe, expect, it } from 'vitest';

import { APP_LOCALES, getAltLanguage, getAppLocale, getLanguage, getNamespaces, isAppLocale, removeLanguageFromPath } from '~/utils/locale-utils';

/*
 * @vitest-environment jsdom
 */

describe('locale-utils', () => {
  describe('APP_LOCALES', () => {
    it('should contain only "en" and "fr"', () => {
      expect(APP_LOCALES).toEqual(['en', 'fr']);
    });
  });

  describe('isAppLocale', () => {
    it.each([
      { input: 'en', expected: true },
      { input: 'fr', expected: true },
      { input: 'es', expected: false },
      { input: 123, expected: false },
      { input: {}, expected: false },
      { input: [], expected: false },
      { input: null, expected: false },
      { input: undefined, expected: false },
    ])('should return $expected for input $input', ({ input, expected }) => {
      expect(isAppLocale(input)).toBe(expected);
    });
  });

  describe('getAltLanguage', () => {
    it.each([
      { language: 'en', expected: 'fr' },
      { language: 'fr', expected: 'en' },
    ])('should return $expected for language $language', ({ language, expected }) => {
      expect(getAltLanguage(language)).toBe(expected);
    });

    it('should throw an error for invalid language', () => {
      expect(() => getAltLanguage('es')).toThrowError(`Could not determine altLanguage for language: es.`);
    });
  });

  describe('getLanguage', () => {
    it.each([
      // pathnames
      { resource: '/en', expected: 'en' },
      { resource: '/en/foo', expected: 'en' },
      { resource: '/fr', expected: 'fr' },
      { resource: '/fr/foo', expected: 'fr' },
      // URLs
      { resource: new URL('https://example.com/en'), expected: 'en' },
      { resource: new URL('https://example.com/en/foo'), expected: 'en' },
      { resource: new URL('https://example.com/fr'), expected: 'fr' },
      { resource: new URL('https://example.com/fr/foo'), expected: 'fr' },
    ])('should return $expected for resource $resource', ({ resource, expected }) => {
      expect(getLanguage(resource)).toBe(expected);
    });

    it('should throw an error for invalid pathname', () => {
      expect(() => getLanguage('/es')).toThrowError(`Could not determine language for pathname: /es.`);
    });
  });

  describe('getNamespaces', () => {
    it('should return an empty array if routes is undefined', () => {
      expect(getNamespaces(undefined)).toEqual([]);
    });

    it('should return an empty array if routes is empty', () => {
      expect(getNamespaces([])).toEqual([]);
    });

    it('should return a unique array of namespaces from route handles', () => {
      const routes = [{ handle: { i18nPreloadNamespace: ['namespace1', 'namespace2'] } }, { handle: { i18nPreloadNamespace: ['namespace2', 'namespace3'] } }];
      expect(getNamespaces(routes)).toEqual(['namespace1', 'namespace2', 'namespace3']);
    });
  });

  describe('removeLanguageFromPath', () => {
    it.each([
      { path: '/en', expected: '' },
      { path: '/fr', expected: '' },
      { path: '/en/foo', expected: '/foo' },
      { path: '/fr/foo', expected: '/foo' },
      { path: '/', expected: '/' },
      { path: '/foo', expected: '/foo' },
      { path: '/es/foo', expected: '/es/foo' },
    ])('should return $expected for path $path', ({ path, expected }) => {
      expect(removeLanguageFromPath(path)).toBe(expected);
    });
  });

  describe('getAppLocale', () => {
    it.each([
      { locale: 'en', expected: 'en' },
      { locale: 'fr', expected: 'fr' },
      { locale: 'es', expected: 'en' },
      { locale: '', expected: 'en' },
    ])('should return $expected for locale $locale', ({ locale, expected }) => {
      expect(getAppLocale(locale)).toBe(expected);
    });
  });
});
