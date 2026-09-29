import { StrictMode } from 'react';

import { render, screen, waitFor, within } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { ErrorSummary } from '~/components/error-summary';
import { ErrorSummaryProvider } from '~/components/error-summary-provider';
import { InputError } from '~/components/input-error';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';

vi.mock(import('~/utils/adobe-analytics.client'), () => ({
  isConfigured: vi.fn(() => true),
  pushValidationErrorEvent: vi.fn(),
}));

Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
  configurable: true,
  value: vi.fn(),
});

interface SummaryHarnessProps {
  actionData: unknown;
  errors: ReadonlyArray<{ id: string; fieldId: string; message: string }>;
  targetOrder?: ReadonlyArray<string>;
}

function SummaryHarness({ actionData, errors, targetOrder }: SummaryHarnessProps) {
  const fieldIds = targetOrder ?? [...new Set(errors.map(({ fieldId }) => fieldId))];

  return (
    <ErrorSummaryProvider actionData={actionData}>
      <ErrorSummary data-testid="error-summary" />
      {errors.map(({ id, fieldId, message }) => (
        <InputError key={id} fieldId={fieldId} message={message} />
      ))}
      {fieldIds.map((fieldId) => (
        <div key={fieldId}>
          <input id={fieldId} aria-label={fieldId} />
        </div>
      ))}
      <button type="button">Preserve focus</button>
    </ErrorSummaryProvider>
  );
}

describe('ErrorSummary', () => {
  it('updates summary order when provider children change without taking focus or reporting validation again', async () => {
    const laterError = { id: 'file-later-error', fieldId: 'file-later', message: 'Later field needs attention' };
    const earlierError = { id: 'file-earlier-error', fieldId: 'file-earlier', message: 'Earlier field needs attention' };
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={actionData} errors={[laterError, earlierError]} targetOrder={['file-later', 'file-earlier']} />, { wrapper: StrictMode });

    const summary = await screen.findByTestId('error-summary');
    const getSummaryMessages = () =>
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent);
    await waitFor(() => expect(getSummaryMessages()).toEqual([laterError.message, earlierError.message]));
    await waitFor(() => expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1));

    const focusTarget = screen.getByRole('button', { name: 'Preserve focus' });
    focusTarget.focus();

    rerender(<SummaryHarness actionData={actionData} errors={[laterError, earlierError]} targetOrder={['file-earlier', 'file-later']} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([earlierError.message, laterError.message]));
    expect(focusTarget).toHaveFocus();
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);
  });

  it('does not observe DOM mutations while errors are registered', () => {
    const error = { id: 'file-one-error', fieldId: 'file-one', message: 'File one needs attention' };
    const observeSpy = vi.spyOn(MutationObserver.prototype, 'observe');

    try {
      render(<SummaryHarness actionData={{ validation: 1 }} errors={[error]} />, { wrapper: StrictMode });

      const summary = screen.getByTestId('error-summary');
      expect(within(summary).getByRole('link', { name: error.message })).toBeInTheDocument();
      expect(observeSpy).not.toHaveBeenCalled();
    } finally {
      observeSpy.mockRestore();
    }
  });

  it('updates summary order when provider children mount or unmount a registered target', async () => {
    const firstError = { id: 'file-one-error', fieldId: 'file-one', message: 'File one needs attention' };
    const secondError = { id: 'file-two-error', fieldId: 'file-two', message: 'File two needs attention' };
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={actionData} errors={[firstError, secondError]} targetOrder={['file-two']} />);

    const summary = await screen.findByTestId('error-summary');
    const getSummaryMessages = () =>
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent);
    await waitFor(() => expect(getSummaryMessages()).toEqual([secondError.message, firstError.message]));

    const focusTarget = screen.getByRole('button', { name: 'Preserve focus' });
    focusTarget.focus();

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, secondError]} targetOrder={['file-one', 'file-two']} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([firstError.message, secondError.message]));

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, secondError]} targetOrder={['file-two']} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([secondError.message, firstError.message]));
    expect(focusTarget).toHaveFocus();
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);
  });

  it('sorts positioned errors by DOM order and places missing targets last', async () => {
    const laterError = { id: 'file-later-error', fieldId: 'file-later', message: 'Later field needs attention' };
    const missingError = { id: 'file-missing-error', fieldId: 'file-missing', message: 'Missing field needs attention' };
    const earlierError = { id: 'file-earlier-error', fieldId: 'file-earlier', message: 'Earlier field needs attention' };

    render(<SummaryHarness actionData={{ validation: 1 }} errors={[laterError, missingError, earlierError]} targetOrder={['file-earlier', 'file-later']} />);

    const summary = await screen.findByTestId('error-summary');
    await waitFor(() => {
      expect(
        within(summary)
          .getAllByRole('link')
          .map((link) => link.textContent),
      ).toEqual([earlierError.message, laterError.message, missingError.message]);
    });
  });

  it.each(['first', 'second'] as const)('removes the %s message without removing another registration for the same field', async (removedMessage) => {
    const firstError = { id: 'file-one-type-error', fieldId: 'file-one', message: 'File type is not supported' };
    const secondError = { id: 'file-one-size-error', fieldId: 'file-one', message: 'File is too large' };
    const remainingError = removedMessage === 'first' ? secondError : firstError;
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={actionData} errors={[firstError, secondError]} />);

    const summary = await screen.findByTestId('error-summary');
    const getSummaryMessages = () =>
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent);
    await waitFor(() => expect(getSummaryMessages()).toEqual([firstError.message, secondError.message]));
    expect(screen.getAllByRole('textbox', { name: firstError.fieldId })).toHaveLength(1);
    expect(within(summary).getByRole('link', { name: firstError.message })).toHaveAttribute('href', '#file-one');
    expect(within(summary).getByRole('link', { name: secondError.message })).toHaveAttribute('href', '#file-one');
    const remainingLink = within(summary).getByRole('link', { name: remainingError.message });
    const focusTarget = screen.getByRole('button', { name: 'Preserve focus' });
    focusTarget.focus();

    rerender(<SummaryHarness actionData={actionData} errors={[remainingError]} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([remainingError.message]));
    expect(within(summary).getByRole('link', { name: remainingError.message })).toBe(remainingLink);
    expect(focusTarget).toHaveFocus();

    rerender(<SummaryHarness actionData={actionData} errors={[]} />);

    await waitFor(() => expect(screen.queryByTestId('error-summary')).not.toBeInTheDocument());
    expect(focusTarget).toHaveFocus();
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);
  });

  it('removes errors for deleted fields without taking focus from the current control', async () => {
    const firstError = { id: 'file-one-error', fieldId: 'file-one', message: 'File one needs attention' };
    const secondError = { id: 'file-two-error', fieldId: 'file-two', message: 'File two needs attention' };
    const thirdError = { id: 'file-three-error', fieldId: 'file-three', message: 'File three needs attention' };
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={undefined} errors={[]} />);

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, secondError, thirdError]} />);

    const summary = screen.getByTestId('error-summary');
    await waitFor(() => expect(summary).toHaveFocus());
    await waitFor(() => expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledWith(['file-one', 'file-two', 'file-three']));
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);
    const focusSpy = vi.spyOn(summary, 'focus');
    const scrollIntoViewSpy = vi.spyOn(summary, 'scrollIntoView');
    scrollIntoViewSpy.mockClear();
    const getSummaryMessages = () =>
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent);
    expect(getSummaryMessages()).toEqual([firstError.message, secondError.message, thirdError.message]);

    const focusTarget = screen.getByRole('button', { name: 'Preserve focus' });
    focusTarget.focus();

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, thirdError]} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([firstError.message, thirdError.message]));
    expect(focusTarget).toHaveFocus();

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, secondError, thirdError]} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([firstError.message, secondError.message, thirdError.message]));
    expect(focusTarget).toHaveFocus();
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);

    rerender(<SummaryHarness actionData={{ validation: 2 }} errors={[firstError, secondError, thirdError]} />);

    await waitFor(() => expect(summary).toHaveFocus());
    await waitFor(() => expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(2));
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenNthCalledWith(2, ['file-one', 'file-two', 'file-three']);
    expect(focusSpy).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
    expect(scrollIntoViewSpy).toHaveBeenCalledExactlyOnceWith({ behavior: 'smooth' });
  });
});
