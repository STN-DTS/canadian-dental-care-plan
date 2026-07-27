import { render, screen } from '@testing-library/react';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { CsrfTokenInput } from '~/components/csrf-token-input';
import { CSRF_FORM_DATA_KEY } from '~/constants/csrf-token';

vi.mock('remix-utils/csrf/react', () => ({
  AuthenticityTokenInput: vi.fn((props) => <input {...props} name={CSRF_FORM_DATA_KEY} type="hidden" value="mock-csrf-token" />),
}));

describe('CsrfTokenInput', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render a hidden input with the CSRF token', () => {
    render(<CsrfTokenInput id="csrf-token" data-testid="csrf-token-input" />);

    const csrfInput = screen.getByTestId('csrf-token-input');
    expect(csrfInput).toBeInTheDocument();
    expect(csrfInput).toHaveAttribute('type', 'hidden');
    expect(csrfInput).toHaveAttribute('name', CSRF_FORM_DATA_KEY);
    expect(csrfInput).toHaveAttribute('value', 'mock-csrf-token');
  });

  it('should spread any additional props to the input element', () => {
    render(<CsrfTokenInput id="csrf-token" className="custom-class" data-testid="test-id" />);

    const csrfInput = screen.getByTestId('test-id');
    expect(csrfInput).toHaveAttribute('class', 'custom-class');
  });
});
