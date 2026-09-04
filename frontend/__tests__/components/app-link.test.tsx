import { render, screen } from '@testing-library/react';

import type { Link } from 'react-router';
import { useHref } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLink } from '~/components/app-link';
import type { AppLinkProps } from '~/components/app-link';
import { getPathById } from '~/utils/route-utils';

vi.mock(import('react-router'), () => ({
  Link: vi.fn<typeof Link>().mockImplementation(({ children }) => <a href="https://www.example.com">{children}</a>),
  useHref: vi.fn<typeof useHref>((to) => to.toString()),
}));

vi.mock(import('~/utils/route-utils'), () => ({
  getPathById: vi.fn((routeId, params) => `/mock-path/${routeId}/${params?.lang ?? ''}`),
}));

describe('AppLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const defaultProps: AppLinkProps = {
    routeId: 'test-route',
  };

  it('should render correctly', () => {
    render(<AppLink {...defaultProps}>Click me</AppLink>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should resolve the `to` prop using getPathById when `routeId` is provided', () => {
    render(<AppLink {...defaultProps}>Click me</AppLink>);
    expect(useHref).toHaveBeenCalledWith('/mock-path/test-route/', { relative: 'route' });
  });

  it('should render an external link correctly', () => {
    render(
      <AppLink {...defaultProps} to="https://www.example.com">
        Click me
      </AppLink>,
    );
    expect(screen.getByText('Click me').closest('a')).toHaveAttribute('href', 'https://www.example.com');
  });

  it('should render the NewTabIndicator when newTabIndicator is true', () => {
    render(
      <AppLink {...defaultProps} newTabIndicator={true}>
        Click me
      </AppLink>,
    );
    expect(screen.getByText('(screenReader.newTab)')).toBeInTheDocument();
  });

  it('should call getPathById with the correct arguments', () => {
    const params = { lang: 'en' };
    render(
      <AppLink {...defaultProps} params={params}>
        Click me
      </AppLink>,
    );
    expect(getPathById).toHaveBeenCalledWith('test-route', { lang: 'en' });
  });
});
