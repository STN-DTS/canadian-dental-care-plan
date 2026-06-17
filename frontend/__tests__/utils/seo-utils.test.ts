import { renderHook } from '@testing-library/react';

import { useLocation } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { getDescriptionMetaTags, getTitleMetaTags, useAlternateLanguages, useCanonicalURL } from '~/utils/seo-utils';

/*
 * @vitest-environment jsdom
 */

vi.mock('react-router');
vi.mock('~/utils/env-utils');
vi.mock('~/utils/route-utils');

describe('useCanonicalURL', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should generate the canonical URL correctly when pathname is not root', () => {
    const mockOrigin = 'https://example.com';
    const mockPathname = '/en/example-path';
    const mockSearch = '?param1=value1&param2=value2';

    vi.mocked(useLocation, { partial: true }).mockReturnValue({ pathname: mockPathname, search: mockSearch });

    const { result } = renderHook(() => useCanonicalURL(mockOrigin));

    expect(result.current).toBe(`${mockOrigin}${mockPathname}${mockSearch}`);
  });

  it('should generate the canonical URL correctly when pathname is root', () => {
    const mockOrigin = 'https://example.com';
    const mockPathname = '/';
    const mockSearch = '?param1=value1&param2=value2';

    vi.mocked(useLocation, { partial: true }).mockReturnValue({ pathname: mockPathname, search: mockSearch });

    const { result } = renderHook(() => useCanonicalURL(mockOrigin));

    expect(result.current).toBe(`${mockOrigin}${mockPathname}${mockSearch}`);
  });
});

describe('useAlternateLanguages', () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should return alternate language URLs with default languages', () => {
    vi.mocked(useLocation, { partial: true }).mockReturnValue({ pathname: '/path', search: '?param=value' });

    const origin = 'https://example.com';
    const expectedUrls = [
      { href: 'https://example.com/en/path?param=value', hrefLang: 'en' },
      { href: 'https://example.com/fr/path?param=value', hrefLang: 'fr' },
    ];

    const { result } = renderHook(() => useAlternateLanguages(origin));

    expect(result.current).toEqual(expectedUrls);
  });

  it('should return alternate language URLs with custom languages', () => {
    vi.mocked(useLocation, { partial: true }).mockReturnValue({ pathname: '/path', search: '?param=value' });

    const origin = 'https://example.com';
    const languages = ['en'] as const;
    const expectedUrls = [{ href: 'https://example.com/en/path?param=value', hrefLang: 'en' }];

    const { result } = renderHook(() => useAlternateLanguages(origin, languages));

    expect(result.current).toEqual(expectedUrls);
  });
});

describe('getTitleMetaTags', () => {
  it('returns an array with title meta tags', () => {
    const title = 'Test Title';
    const expected = [{ title: title }, { property: 'og:title', content: title }, { property: 'dcterms.title', content: title }];
    expect(getTitleMetaTags(title)).toEqual(expected);
  });

  it('returns an array with title meta tags with different dcterms.title content', () => {
    const title = 'Test Title';
    const dcTermsTitle = 'Test DcTerms Title';
    const expected = [{ title: title }, { property: 'og:title', content: title }, { property: 'dcterms.title', content: dcTermsTitle }];
    expect(getTitleMetaTags(title, dcTermsTitle)).toEqual(expected);
  });
});

describe('getDescriptionMetaTags', () => {
  it('returns an array with description meta tags', () => {
    const description = 'Test Description';
    const expected = [
      { name: 'description', content: description },
      { property: 'og:description', content: description },
    ];
    expect(getDescriptionMetaTags(description)).toEqual(expected);
  });
});
