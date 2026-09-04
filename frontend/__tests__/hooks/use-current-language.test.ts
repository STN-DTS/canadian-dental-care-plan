import { useLocation } from 'react-router';

import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { useCurrentLanguage } from '~/hooks/use-current-language';
import { getAltLanguage, getLanguage } from '~/utils/locale-utils';

vi.mock(import('react-router'), () => ({
  useLocation: vi.fn(),
}));

vi.mock(import('~/utils/locale-utils'), () => ({
  getLanguage: vi.fn(),
  getAltLanguage: vi.fn(),
}));

describe('useCurrentLanguage', () => {
  it('should return the current and alternate languages', () => {
    vi.mocked(useLocation).mockReturnValue(mock({ pathname: '/en/some-route' }));
    vi.mocked(getLanguage).mockReturnValue('en');
    vi.mocked(getAltLanguage).mockReturnValue('fr');

    expect(useCurrentLanguage()).toEqual({ currentLanguage: 'en', altLanguage: 'fr' });
  });

  it('should return the current and alternate languages for french', () => {
    vi.mocked(useLocation).mockReturnValue(mock({ pathname: '/fr/some-route' }));
    vi.mocked(getLanguage).mockReturnValue('fr');
    vi.mocked(getAltLanguage).mockReturnValue('en');

    expect(useCurrentLanguage()).toEqual({ currentLanguage: 'fr', altLanguage: 'en' });
  });

  it('should throw when no langauge can be detected)', () => {
    vi.mocked(useLocation).mockReturnValue(mock({ pathname: '/some-route' }));
    vi.mocked(getLanguage).mockImplementation(() => {
      throw new Error(`Could not determine language for pathname: /some-route.`);
    });

    expect(() => useCurrentLanguage()).toThrowError(`Could not determine language for pathname: /some-route.`);
  });

  it('should throw when no altLangauge can be detected)', () => {
    vi.mocked(useLocation).mockReturnValue(mock({ pathname: '/some-route' }));
    vi.mocked(getLanguage).mockReturnValue('en');
    vi.mocked(getAltLanguage).mockImplementation(() => {
      throw new Error('Could not determine altLanguage for language: en');
    });

    expect(() => useCurrentLanguage()).toThrowError('Could not determine altLanguage for language: en');
  });
});
