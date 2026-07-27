import { render, screen } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CsrfTokenInput } from '~/components/csrf-token-input';
import { useCsrfToken } from '~/root';

vi.mock('remix-utils/csrf/react', () => ({
  AuthenticityTokenInput: vi.fn(() => <input type="hidden" name="_authenticity_token" value="mock-authenticity-token" data-testid="authenticity-token-input" />),
}));

vi.mock('~/root', () => ({
  useCsrfToken: vi.fn(),
}));

describe('CsrfTokenInput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render a hidden input with the CSRF token', () => {
    const csrfToken = 'mock-csrf-token';
    vi.mocked(useCsrfToken).mockReturnValue(csrfToken);

    render(<CsrfTokenInput name="_csrf" id="csrf-token" data-testid="csrf-token-input" />);

    const csrfInput = screen.getByTestId('csrf-token-input');
    expect(csrfInput).toBeInTheDocument();
    expect(csrfInput).toHaveAttribute('type', 'hidden');
    expect(csrfInput).toHaveAttribute('name', '_csrf');
    expect(csrfInput).toHaveAttribute('value', csrfToken);
  });

  it('should spread any additional props to the input element', () => {
    const csrfToken = 'mock-csrf-token';
    vi.mocked(useCsrfToken).mockReturnValue(csrfToken);

    render(<CsrfTokenInput name="_csrf" id="csrf-token" className="custom-class" data-testid="test-id" />);

    const csrfInput = screen.getByTestId('test-id');
    expect(csrfInput).toHaveAttribute('class', 'custom-class');
  });
});
