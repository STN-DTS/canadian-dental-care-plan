import { render } from '@testing-library/react';

import { createRoutesStub } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PageHeaderBrand } from '~/components/page-header-brand';

vi.mock(import('~/components/language-switcher'), () => ({
  LanguageSwitcher: vi.fn().mockImplementation(({ children }) => <div>{children}</div>),
}));

vi.mock(import('~/hooks'), () => ({
  useCurrentLanguage: vi.fn().mockReturnValue({
    currentLanguage: 'en',
    altLanguage: 'fr',
  }),
}));

vi.mock(import('~/utils/locale-utils'), () => ({
  getAltLanguage: vi.fn().mockImplementation((lang: string) => lang),
}));

describe('PageHeaderBrand', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('displays the Government of Canada logo', () => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => <PageHeaderBrand />,
        path: '/',
      },
    ]);
    const { getByAltText } = render(<RoutesStub />);
    expect(getByAltText('header.govtOfCanadaText')).toBeInTheDocument();
  });

  it('displays the Language Switcher', () => {
    const RoutesStub = createRoutesStub([
      {
        Component: () => <PageHeaderBrand />,
        path: '/',
      },
    ]);
    const { getByText } = render(<RoutesStub />);
    expect(getByText('languageSwitcher.altLang')).toBeInTheDocument();
  });
});
