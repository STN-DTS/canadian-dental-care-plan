import { render, screen } from '@testing-library/react';

import { describe, expect, it } from 'vitest';

import { AppErrorDetails } from '~/components/app-error-details';
import { AppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';

function translation(key: string, lng?: string) {
  return JSON.stringify({ key: `serverError.${key}`, options: lng ? { lng } : {} });
}

describe('AppErrorDetails', () => {
  it('renders the available error details and preserves them on rerender', () => {
    const error = new AppError('Never display this message', ErrorCodes.DEV_TEST_ERROR, { correlationId: 'AB-123456' });
    const view = render(<AppErrorDetails error={error} />);

    expect(view.container.querySelectorAll('dt')).toHaveLength(2);
    expect(view.container.querySelectorAll('dd')).toHaveLength(2);
    expect(screen.getByText(translation('correlationId'))).toBeVisible();
    expect(screen.getByText(translation('errorCode'))).toBeVisible();
    expect(screen.getByText(error.correlationId)).toHaveClass('font-mono', 'min-w-0', 'wrap-anywhere');
    expect(screen.getByText(error.correlationId)).not.toHaveClass('select-text');
    expect(screen.getByText(error.errorCode)).toHaveClass('font-mono', 'min-w-0', 'wrap-anywhere');
    expect(screen.getByText(error.errorCode)).not.toHaveClass('select-text');
    expect(view.container).not.toHaveTextContent(error.message);
    expect(view.container.querySelector('[tabindex], button, a')).toBeNull();

    view.rerender(<AppErrorDetails error={{ status: 500, statusText: '', internal: false, data: JSON.parse(JSON.stringify(error)) }} />);
    expect(screen.getByText(error.correlationId)).toBeVisible();
    expect(screen.getByText(error.errorCode)).toBeVisible();
  });

  it('passes the requested language to the translation function', () => {
    const error = new AppError('Synthetic failure', ErrorCodes.DEV_TEST_ERROR, { correlationId: 'AB-123456' });
    render(
      <>
        <AppErrorDetails error={error} lng="en" />
        <AppErrorDetails error={error} lng="fr" />
      </>,
    );
    expect(screen.getByText(translation('correlationId', 'en'))).toBeVisible();
    expect(screen.getByText(translation('correlationId', 'fr'))).toBeVisible();
    expect(screen.getAllByText(error.correlationId)).toHaveLength(2);
    expect(screen.getByText(translation('errorCode', 'en'))).toBeVisible();
    expect(screen.getByText(translation('errorCode', 'fr'))).toBeVisible();
    expect(screen.getAllByText(error.errorCode)).toHaveLength(2);
  });

  it.each([undefined, new Error('Synthetic failure'), { name: 'AppError' }])('renders nothing for unavailable IDs', (error) => {
    const { container } = render(<AppErrorDetails error={error} />);
    expect(container).toBeEmptyDOMElement();
  });

  it.each([new AppError('No ID', ErrorCodes.DEV_TEST_ERROR), new AppError('Blank ID', ErrorCodes.DEV_TEST_ERROR, { correlationId: ' ' })])('renders the error code when no correlation ID is available', (error) => {
    const view = render(<AppErrorDetails error={error} />);
    expect(view.container.querySelectorAll('dt')).toHaveLength(1);
    expect(view.container.querySelectorAll('dd')).toHaveLength(1);
    expect(screen.queryByText(translation('correlationId'))).not.toBeInTheDocument();
    expect(screen.getByText(translation('errorCode'))).toBeVisible();
    expect(screen.getByText(error.errorCode)).toBeVisible();
  });
});
