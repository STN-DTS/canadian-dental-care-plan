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
  errors: ReadonlyArray<{ fieldId: string; message: string }>;
  targetOrder?: ReadonlyArray<string>;
}

function SummaryHarness({ actionData, errors, targetOrder }: SummaryHarnessProps) {
  const fieldIds = targetOrder ?? errors.map(({ fieldId }) => fieldId);

  return (
    <ErrorSummaryProvider actionData={actionData}>
      <ErrorSummary data-testid="error-summary" />
      {errors.map(({ fieldId, message }) => (
        <InputError key={fieldId} fieldId={fieldId} message={message} />
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
  it('updates summary order when mounted targets move in the DOM', async () => {
    const laterError = { fieldId: 'file-later', message: 'Later field needs attention' };
    const earlierError = { fieldId: 'file-earlier', message: 'Earlier field needs attention' };
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={actionData} errors={[laterError, earlierError]} targetOrder={['file-later', 'file-earlier']} />);

    const summary = await screen.findByTestId('error-summary');
    const getSummaryMessages = () =>
      within(summary)
        .getAllByRole('link')
        .map((link) => link.textContent);
    await waitFor(() => expect(getSummaryMessages()).toEqual([laterError.message, earlierError.message]));

    rerender(<SummaryHarness actionData={actionData} errors={[laterError, earlierError]} targetOrder={['file-earlier', 'file-later']} />);

    await waitFor(() => expect(getSummaryMessages()).toEqual([earlierError.message, laterError.message]));
  });

  it('sorts positioned errors by DOM order and places missing targets last', async () => {
    const laterError = { fieldId: 'file-later', message: 'Later field needs attention' };
    const missingError = { fieldId: 'file-missing', message: 'Missing field needs attention' };
    const earlierError = { fieldId: 'file-earlier', message: 'Earlier field needs attention' };

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

  it('removes errors for deleted fields without taking focus from the current control', async () => {
    const firstError = { fieldId: 'file-one', message: 'File one needs attention' };
    const secondError = { fieldId: 'file-two', message: 'File two needs attention' };
    const thirdError = { fieldId: 'file-three', message: 'File three needs attention' };
    const actionData = { validation: 1 };
    const { rerender } = render(<SummaryHarness actionData={undefined} errors={[]} />);

    rerender(<SummaryHarness actionData={actionData} errors={[firstError, secondError, thirdError]} />);

    const summary = screen.getByTestId('error-summary');
    await waitFor(() => expect(summary).toHaveFocus());
    await waitFor(() => expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledWith(['file-one', 'file-two', 'file-three']));
    expect(adobeAnalytics.pushValidationErrorEvent).toHaveBeenCalledTimes(1);
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
  });
});
