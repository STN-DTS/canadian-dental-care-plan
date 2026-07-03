import { render, screen, waitFor } from '@testing-library/react';

import { createRoutesStub, useMatches, useParams, useSearchParams } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LanguageSwitcher } from '~/components/language-switcher';
import { getAltLanguage } from '~/utils/locale-utils';

vi.mock('react-router', async (actual) => {
  // XXX :: GjB :: using actual <Link> component and useHref hook because I'm too lazy to mock it 🤷
  // eslint-disable-next-line @typescript-eslint/consistent-type-imports
  const rr = await actual<typeof import('react-router')>();

  return {
    ...rr,
    useLocation: vi.fn(),
    useMatches: vi.fn(),
    useParams: vi.fn(),
    useSearchParams: vi.fn(),
  };
});

vi.mock('~/hooks', () => ({
  useCurrentLanguage: vi.fn().mockReturnValue({
    currentLanguage: 'en',
    altLanguage: 'fr',
  }),
}));

vi.mock('~/utils/env-utils', () => ({
  getClientEnv: vi.fn(),
}));

vi.mock('~/utils/locale-utils', () => ({
  getAltLanguage: vi.fn(),
  removeLanguageFromPath: vi.fn(),
}));

describe('Language Switcher', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('Should render with correct search params, and not have a11y issues', async () => {
    const requestedLang = 'en';
    const responseLang = 'fr';

    vi.mocked(useParams).mockReturnValue({ lang: requestedLang });
    vi.mocked(useSearchParams).mockReturnValue([new URLSearchParams({ id: '1' }), vi.fn()]);
    vi.mocked(getAltLanguage).mockReturnValue(responseLang);
    vi.mocked(useMatches).mockReturnValue([{ id: 'public/application/index', loaderData: {}, handle: {}, params: {}, pathname: '' }]);

    const RoutesStub = createRoutesStub([{ Component: () => <LanguageSwitcher data-testid="language-switcher">Français</LanguageSwitcher>, path: '/' }]);
    render(<RoutesStub />);

    const element = await waitFor(async () => await screen.findByTestId('language-switcher'));

    expect(element.textContent).toBe('Français');
    expect(element.getAttribute('href')).toBe('/fr/demande?id=1');
  });
});
