import { render, screen } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorAlert } from '~/components/app-error-alert';
import type { AppErrorHandlerMap, AppErrorMessageProps } from '~/components/app-error-messages';
import { DefaultAppErrorMessage, resolveAppErrorMessage } from '~/components/app-error-messages';
import { ErrorCodes } from '~/errors/error-codes';
import type { ErrorCode } from '~/errors/error-codes';
import type { ActionAppError } from '~/errors/error-predicates';

function createActionError(errorCode: ErrorCode, correlationId = 'AB-123456'): ActionAppError {
  return {
    appError: {
      name: 'AppError',
      errorCode,
      correlationId,
    },
  };
}

function CustomErrorMessage({ headingId, error }: AppErrorMessageProps) {
  return (
    <>
      <h2 id={headingId}>Custom heading for {error.errorCode}</h2>
      <p>Custom body</p>
    </>
  );
}

const scrollIntoViewMock = vi.fn();

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: scrollIntoViewMock,
});

describe('AppErrorAlert', () => {
  const focusMock = vi.fn();

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(focusMock);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    scrollIntoViewMock.mockReset();
    focusMock.mockReset();
  });

  it('renders nothing when actionData has no AppError or while submitting', () => {
    const empty = render(<AppErrorAlert actionData={undefined} />);
    expect(empty.container).toBeEmptyDOMElement();

    const validationOnly = render(<AppErrorAlert actionData={{ errors: { acknowledgeInfo: ['Required'] } }} />);
    expect(validationOnly.container).toBeEmptyDOMElement();

    const submitting = render(<AppErrorAlert actionData={createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED)} isSubmitting />);
    expect(submitting.container).toBeEmptyDOMElement();
    expect(focusMock).not.toHaveBeenCalled();
  });

  it('matches snapshot for default fallback AppError message', () => {
    const { container } = render(<AppErrorAlert actionData={createActionError(ErrorCodes.DEV_TEST_ERROR)} />);
    expect(container).toMatchSnapshot('default fallback alert');
  });

  it('matches snapshot for application submission failure preset', () => {
    const { container } = render(<AppErrorAlert actionData={createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED)} />);
    expect(container).toMatchSnapshot('application submission failed alert');
  });

  it('matches snapshot for renewal submission failure preset', () => {
    const { container } = render(<AppErrorAlert actionData={createActionError(ErrorCodes.API_BENEFIT_RENEWAL_CREATE_FAILED)} />);
    expect(container).toMatchSnapshot('renewal submission failed alert');
  });

  it('uses GOV.UK split focus and live-region structure and focuses the outer section', () => {
    const actionData = createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED, 'CD-987654');
    const { container } = render(<AppErrorAlert actionData={actionData} />);

    const section = container.querySelector('section');
    const alert = screen.getByRole('alert');
    const heading = screen.getByRole('heading', { level: 2 });

    expect(section).not.toBeNull();
    expect(section).toHaveAttribute('tabindex', '-1');
    expect(section).not.toHaveAttribute('role', 'alert');
    expect(section).toHaveAttribute('aria-labelledby', heading.id);
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(alert).not.toHaveAttribute('aria-live');
    expect(section).toContainElement(alert);
    expect(alert).toContainElement(heading);

    expect(screen.getByText(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED)).toBeVisible();
    expect(screen.getByText('CD-987654')).toBeVisible();

    expect(scrollIntoViewMock).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth', block: 'nearest' });
    expect(focusMock).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
  });

  it('re-focuses on consecutive identical errors with a new actionData reference, but not on unrelated rerenders', () => {
    const firstFailure = createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED);
    const { rerender } = render(<AppErrorAlert actionData={firstFailure} />);
    expect(focusMock).toHaveBeenCalledTimes(1);

    // Unrelated rerender with the same actionData reference should not re-focus.
    rerender(<AppErrorAlert actionData={firstFailure} className="mt-2" />);
    expect(focusMock).toHaveBeenCalledTimes(1);

    // Next failed submission produces a new actionData reference with the same errorCode.
    const secondFailure = createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED);
    rerender(<AppErrorAlert actionData={secondFailure} />);
    expect(focusMock).toHaveBeenCalledTimes(2);
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(2);
  });

  it('resolves handlers in 3-tier order without per-page maps shadowing global defaults', () => {
    const globalHandlers: AppErrorHandlerMap = {
      [ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED]: CustomErrorMessage,
    };
    const pageHandlers: AppErrorHandlerMap = {
      [ErrorCodes.DEV_TEST_ERROR]: CustomErrorMessage,
    };

    expect(resolveAppErrorMessage(ErrorCodes.DEV_TEST_ERROR, pageHandlers, globalHandlers)).toBe(CustomErrorMessage);
    expect(resolveAppErrorMessage(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED, pageHandlers, globalHandlers)).toBe(CustomErrorMessage);
    expect(resolveAppErrorMessage(ErrorCodes.API_BENEFIT_RENEWAL_CREATE_FAILED, pageHandlers, globalHandlers)).toBe(DefaultAppErrorMessage);
  });

  it('renders a custom hook-using per-page handler component safely across hidden and visible transitions', () => {
    const handlers: AppErrorHandlerMap = {
      [ErrorCodes.DEV_TEST_ERROR]: DefaultAppErrorMessage,
      [ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED]: CustomErrorMessage,
    };

    const { rerender } = render(<AppErrorAlert actionData={undefined} handlers={handlers} />);
    rerender(<AppErrorAlert actionData={createActionError(ErrorCodes.DEV_TEST_ERROR)} handlers={handlers} />);
    expect(screen.getByRole('heading', { level: 2 })).toBeVisible();

    rerender(<AppErrorAlert actionData={createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED)} handlers={handlers} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(`Custom heading for ${ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED}`);
    expect(screen.getByText('Custom body')).toBeVisible();
  });

  it('supports simple heading and children overrides without a handler map', () => {
    const { container } = render(
      <AppErrorAlert actionData={createActionError(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED)} heading="Route-specific heading">
        <p>Route-specific body</p>
      </AppErrorAlert>,
    );

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Route-specific heading');
    expect(container.querySelector('section')).toHaveAttribute('aria-labelledby', heading.id);
    expect(screen.getByText('Route-specific body')).toBeVisible();
    expect(screen.getByText(ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED)).toBeVisible();
  });

  it('defaults headingId via useId when a message component is rendered standalone', () => {
    render(<DefaultAppErrorMessage error={createActionError(ErrorCodes.DEV_TEST_ERROR).appError} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.id).not.toBe('');
  });
});
