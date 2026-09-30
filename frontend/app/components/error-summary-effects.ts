import { useEffect, useEffectEvent, useRef } from 'react';

import { useErrorSummaryContext } from '~/components/error-summary-context';
import type { ErrorMessage, ErrorSummaryContextValue } from '~/components/error-summary-context';
import * as adobeAnalytics from '~/utils/adobe-analytics.client';

/**
 * Commits a pending validation run after field errors have registered.
 *
 * The provider renders {@link ErrorSummaryEffects} after its form descendants,
 * allowing their registration effects to run before this hook commits the run.
 * Completing the run advances the counter observed by the focus and analytics
 * hooks. Nothing is committed without a context or a pending run.
 *
 * @param context The provider context, or undefined outside a provider.
 */
export function useErrorSummaryCommitter(context: ErrorSummaryContextValue | undefined): void {
  const { completeValidation, pendingValidation } = context ?? {};
  useEffect(() => {
    if (pendingValidation && completeValidation) {
      completeValidation();
    }
  }, [completeValidation, pendingValidation]);
}

/**
 * Focuses the summary when a new validation run is observed and errors remain.
 *
 * The initial counter value is the baseline, not a new run. Later counter
 * changes trigger focus; error registration changes alone do not move focus.
 * An Effect Event reads the latest errors and summary ID without making them
 * effect dependencies. Missing contexts, empty lists, and absent summary
 * elements are ignored.
 *
 * @param context The provider context, or undefined outside a provider.
 */
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

/**
 * Reports errors at most once per newly observed validation run.
 *
 * The initial counter value is the baseline. An Effect Event reads the current
 * errors when the counter changes, so registration changes alone do not emit
 * another event. Reporting is skipped without a context, registered errors,
 * or configured analytics.
 *
 * @param context The provider context, or undefined outside a provider.
 */
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

/**
 * Narrows an optional error list to a non-empty readonly tuple.
 *
 * @param errors The current registered errors, if a provider is available.
 * @returns Whether at least one error is registered.
 */
function hasSummaryErrors(errors: ReadonlyArray<ErrorMessage> | undefined): errors is readonly [ErrorMessage, ...ErrorMessage[]] {
  return errors !== undefined && errors.length > 0;
}

/**
 * Scrolls to and focuses the summary identified by its provider data attribute.
 *
 * The lookup does not depend on the section's DOM ID. `preventScroll` preserves
 * the explicit smooth scroll by preventing focus from starting another scroll.
 * A missing summary element is ignored.
 *
 * @param summaryId The provider-generated `data-error-summary-id` value.
 */
function focusErrorSummary(summaryId: string): void {
  const element = document.querySelector<HTMLElement>(`[data-error-summary-id="${summaryId}"]`);
  if (!element) return;

  element.scrollIntoView({ behavior: 'smooth' });
  element.focus({ preventScroll: true });
}

/**
 * Sends registered field IDs to Adobe Analytics when analytics is configured.
 *
 * Preserves summary order and includes one field ID per error registration.
 * Multiple messages for one field therefore produce repeated IDs. Message text
 * is not included in the event.
 *
 * @param errors The current errors in summary display order.
 */
function reportValidationErrorsToAnalytics(errors: ReadonlyArray<ErrorMessage>): void {
  if (!adobeAnalytics.isConfigured()) return;
  adobeAnalytics.pushValidationErrorEvent(errors.map(({ fieldId }) => fieldId));
}

/**
 * Runs one provider's validation commit, focus, and analytics hooks.
 *
 * The provider places this component after its form descendants so field
 * registration effects run before a pending validation is committed.
 * Committing schedules an update; focus and analytics respond to the updated
 * counter in a later effect pass, not immediately after the committer call.
 * All three hooks are safe to call without a surrounding provider.
 *
 * @returns Null; this component renders no DOM.
 */
export function ErrorSummaryEffects(): null {
  const context = useErrorSummaryContext();
  useErrorSummaryCommitter(context);
  useErrorSummaryFocusHandler(context);
  useErrorSummaryAnalyticsReporter(context);
  return null;
}
