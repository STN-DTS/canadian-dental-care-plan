import { render, screen } from '@testing-library/react';

import { useHref } from 'react-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppLink } from '~/components/app-link';
import type { AppLinkProps } from '~/components/app-link';
import { getPathById } from '~/utils/route-utils';

vi.mock('react-router', () => ({
  Link: vi.fn(({ children }) => <a href="https://www.example.com">{children}</a>),
  useHref: vi.fn((to) => to),
}));

vi.mock('~/utils/route-utils', () => ({
  getPathById: vi.fn((routeId, params) => `/mock-path/${routeId}/${params?.lang ?? ''}`),
}));

describe('AppLink', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  const defaultProps: AppLinkProps = {
    children: 'Click me',
    routeId: 'test-route',
  };

  it('should render correctly', () => {
    const { children, ...rest } = defaultProps;
    render(<AppLink {...rest}>{children}</AppLink>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('should resolve the `to` prop using getPathById when `routeId` is provided', () => {
    const { children, ...rest } = defaultProps;
    render(<AppLink {...rest}>{children}</AppLink>);
    expect(useHref).toHaveBeenCalledWith('/mock-path/test-route/', { relative: 'route' });
  });

  it('should render an external link correctly', () => {
    const { children, ...restProps } = defaultProps;
    render(
      <AppLink {...restProps} to="https://www.example.com">
        {children}
      </AppLink>,
    );
    expect(screen.getByText('Click me').closest('a')).toHaveAttribute('href', 'https://www.example.com');
  });

  it('should render the NewTabIndicator when newTabIndicator is true', () => {
    const { children, ...restProps } = defaultProps;
    render(
      <AppLink {...restProps} newTabIndicator={true}>
        {children}
      </AppLink>,
    );
    expect(screen.getByText('(screenReader.newTab)')).toBeInTheDocument();
  });

  it('should call getPathById with the correct arguments', () => {
    const params = { lang: 'en' };
    const { children, ...rest } = defaultProps;
    render(
      <AppLink {...rest} params={params}>
        {children}
      </AppLink>,
    );
    expect(getPathById).toHaveBeenCalledWith('test-route', { lang: 'en' });
  });
});
