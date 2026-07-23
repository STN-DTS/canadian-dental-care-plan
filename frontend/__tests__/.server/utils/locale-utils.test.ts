import { afterEach, describe, expect, it, vi } from 'vitest';

import { getEnv } from '~/.server/utils/env-utils';
import { getFixedT, getLocale, getLocaleFromParams, initI18n } from '~/.server/utils/locale-utils';

// locale-utils uses the actual implementation of react-i18next's functions
// rather than the mocked version to ensure real behavior is tested.
vi.unmock('react-i18next');

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn(),
}));

describe('locale-utils', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getLocale()', () => {
    it('should return the locale from the URL if it exists', () => {
      expect(getLocale(new URL('http://localhost:3000/en/home'))).toEqual('en');
      expect(getLocale(new URL('http://localhost:3000/fr/home'))).toEqual('fr');
    });

    it('should return the default locale if there is no locale in the URL', () => {
      expect(getLocale(new URL('http://localhost:3000/'))).toEqual('en');
    });
  });

  describe('getLocaleFromParams', () => {
    it('should return "en" when lang is "en"', () => {
      const params = { lang: 'en' };
      expect(getLocaleFromParams(params)).toBe('en');
    });

    it('should return "fr" when lang is "fr"', () => {
      const params = { lang: 'fr' };
      expect(getLocaleFromParams(params)).toBe('fr');
    });

    it('should return "en" when lang is unsupported', () => {
      const params = { lang: 'es' };
      expect(getLocaleFromParams(params)).toBe('en');
    });

    it('should return "en" when lang is undefined', () => {
      const params = {};
      expect(getLocaleFromParams(params)).toBe('en');
    });
  });

  describe('getFixedT<>()', () => {
    it('should return a t function that uses the detected language', async () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ I18NEXT_DEBUG: false });

      const t = await getFixedT(new URL('http://localhost:3000/'), 'gcweb');

      // GjB :: not sure how else to test this 🤷
      expect(t).toBeDefined();
      expect(typeof t).toEqual('function');
    });
  });

  describe('initI18n<>()', () => {
    it('should initialize i18next with the correct options', async () => {
      vi.mocked(getEnv, { partial: true }).mockReturnValue({ I18NEXT_DEBUG: false });

      const i18n = await initI18n('en', 'gcweb');

      // we only care that the init function respects our env and params
      // (ie: no need to test the statically-set values)
      expect(i18n.options.debug).toEqual(false);
      expect(i18n.options.lng).toEqual('en');
      expect(i18n.options.ns).toEqual(['gcweb']);
    });
  });
});
