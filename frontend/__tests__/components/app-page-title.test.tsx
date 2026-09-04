import { render } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { AppPageTitle } from '~/components/app-page-title';

vi.mock(import('~/hooks'), () => ({
  useAccessibleFocusManagement: vi.fn(),
}));

describe('AppPageTitle', () => {
  it('should render the AppPageTitle', () => {
    const { container } = render(<AppPageTitle>My Page Title</AppPageTitle>);
    expect(container).toMatchSnapshot('expected html');
  });
});
