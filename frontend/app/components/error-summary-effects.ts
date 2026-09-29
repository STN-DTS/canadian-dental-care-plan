import { useEffect, useEffectEvent, useRef } from 'react';

import { useErrorSummaryContext } from '~/components/error-summary-context';
import type { ErrorMessage, ErrorSummaryContextValue } from '~/components/error-summary-context';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';

/** Completes a pending run after descendant effects register current errors. */
export function useErrorSummaryCommitter(context: ErrorSummaryContextValue | undefined): void {
  const { completeValidation, pendingValidation } = context ?? {};
  useEffect(() => {
    if (pendingValidation && completeValidation) {
      completeValidation();
    }
  }, [completeValidation, pendingValidation]);
}

/** Focuses the summary only when a new validation run contains current errors. */
export function useErrorSummaryFocusHandler(context: ErrorSummaryContextValue | undefined): void {
  const { errors, summaryId, validationRun } = context ?? {};
  const previousValidationRun = useRef(validationRun);

  const focusCurrentErrorSummary = useEffectEvent(() => {
    if (!hasSummaryErrors(errors) || !summaryId) return;
    focusErrorSummary(summaryId);
  });

  useEffect(() => {
    if (validationRun === undefined) return;

    const isNewValidation = previousValidationRun.current !== validationRun;
    previousValidationRun.current = validationRun;

    if (isNewValidation) {
      focusCurrentErrorSummary();
    }
  }, [validationRun]);
}

/** Sends analytics once for each completed validation run. */
export function useErrorSummaryAnalyticsReporter(context: ErrorSummaryContextValue | undefined): void {
  const { errors, validationRun } = context ?? {};
  const previousValidationRun = useRef(validationRun);

  const reportCurrentErrors = useEffectEvent(() => {
    if (!hasSummaryErrors(errors)) return;
    reportValidationErrorsToAnalytics(errors);
  });

  useEffect(() => {
    if (validationRun === undefined) return;

    const isNewValidation = previousValidationRun.current !== validationRun;
    previousValidationRun.current = validationRun;

    if (isNewValidation) {
      reportCurrentErrors();
    }
  }, [validationRun]);
}

function hasSummaryErrors(errors: ReadonlyArray<ErrorMessage> | undefined): errors is readonly [ErrorMessage, ...ErrorMessage[]] {
  return errors !== undefined && errors.length > 0;
}

function focusErrorSummary(summaryId: string): void {
  const element = document.querySelector<HTMLElement>(`[data-error-summary-id="${summaryId}"]`);
  if (!element) return;

  element.scrollIntoView({ behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

function reportValidationErrorsToAnalytics(errors: ReadonlyArray<ErrorMessage>): void {
  if (!adobeAnalytics.isConfigured()) return;
  adobeAnalytics.pushValidationErrorEvent(errors.map(({ fieldId }) => fieldId));
}

/** Runs validation effects after provider descendants render. */
export function ErrorSummaryEffects(): null {
  const context = useErrorSummaryContext();
  useErrorSummaryCommitter(context);
  useErrorSummaryFocusHandler(context);
  useErrorSummaryAnalyticsReporter(context);
  return null;
}
