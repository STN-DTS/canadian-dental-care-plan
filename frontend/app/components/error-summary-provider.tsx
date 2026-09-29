import type React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer } from 'react';
import type { JSX } from 'react';

import { ErrorSummaryContext } from '~/components/error-summary-context';
import type { ErrorSummaryContextValue, NewError } from '~/components/error-summary-context';
import { ErrorSummaryEffects } from '~/components/error-summary-effects';
import { errorSummaryReducer, initialErrorSummaryState, sortRegisteredErrors } from '~/components/error-summary-registry';

/** Input accepted by {@link ErrorSummaryProvider}. */
interface ErrorSummaryProviderProps {
  /** Form content and field messages that share this provider's error registry. */
  children: React.ReactNode;

  /**
   * Current form action result.
   *
   * A changed value starts a validation cycle. Field registration changes do
   * not start a cycle or request focus.
   */
  actionData: unknown;
}

/**
 * Provides a live error registry and validation lifecycle to form descendants.
 *
 * Field messages register errors while mounted and remove them on unmount.
 * Errors follow the DOM order of their target fields. When action data changes,
 * the provider commits a validation run after descendants have registered,
 * allowing focus and analytics effects to read the current error list.
 *
 * @param children Form content that consumes or contributes to the summary.
 * @param actionData Current action result; a changed value starts a new run.
 * @returns The provider wrapping form content and summary side effects.
 */
export function ErrorSummaryProvider({ children, actionData }: ErrorSummaryProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(errorSummaryReducer, initialErrorSummaryState);
  const summaryId = useId();

  // Keep committed order while newly registered targets wait for layout sorting.
  const errors = useMemo(() => {
    const orderedErrors = state.orderedErrorIds.flatMap((registrationId) => {
      const error = state.registeredErrors.get(registrationId);
      return error ? [error] : [];
    });
    const orderedIds = new Set(state.orderedErrorIds);
    const unpositionedErrors = [...state.registeredErrors].filter(([registrationId]) => !orderedIds.has(registrationId)).map(([, error]) => error);
    return [...orderedErrors, ...unpositionedErrors];
  }, [state.orderedErrorIds, state.registeredErrors]);

  /** Adds or updates one mounted field's error registration. */
  const registerError = useCallback((registrationId: string, error: NewError) => {
    dispatch({ type: 'REGISTER_ERROR', registrationId, error });
  }, []);

  /** Removes one field's error registration and its remembered order. */
  const unregisterError = useCallback((registrationId: string) => {
    dispatch({ type: 'UNREGISTER_ERROR', registrationId });
  }, []);

  useLayoutEffect(() => {
    const registrationIds = sortRegisteredErrors(state.registeredErrors);
    dispatch({ type: 'SORT_ERRORS', registrationIds });
    // Child layout can reorder targets without changing field registrations.
  }, [children, state.registeredErrors]);

  useEffect(() => {
    // Only action-data changes start validation; local field changes do not.
    dispatch({ type: 'START_VALIDATION' });
  }, [actionData]);

  /** Completes a pending cycle; the reducer ignores duplicate completions. */
  const completeValidation = useCallback(() => {
    dispatch({ type: 'COMPLETE_VALIDATION' });
  }, []);

  // Keep the context value stable unless errors or validation state change.
  const contextValue = useMemo<ErrorSummaryContextValue>(
    () => ({ errors, registerError, summaryId, unregisterError, pendingValidation: state.pendingValidation, validationRun: state.validationRun, completeValidation }),
    [errors, registerError, summaryId, unregisterError, state.pendingValidation, state.validationRun, completeValidation],
  );

  return (
    <ErrorSummaryContext value={contextValue}>
      {children}
      {/* Keep last so child error registrations complete before validation commits. */}
      <ErrorSummaryEffects />
    </ErrorSummaryContext>
  );
}
