import type React from 'react';
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useReducer } from 'react';
import type { JSX } from 'react';

import { ErrorSummaryContext } from '~/components/error-summary-context';
import type { ErrorSummaryContextValue, NewError } from '~/components/error-summary-context';
import { ErrorSummaryEffects } from '~/components/error-summary-effects';
import { errorSummaryReducer, initialErrorSummaryState, sortRegisteredErrors } from '~/components/error-summary-registry';

/**
 * Form content and validation trigger accepted by {@link ErrorSummaryProvider}.
 */
interface ErrorSummaryProviderProps {
  /**
   * Form content and field messages that share this provider's error registry.
   * Changes to this prop trigger ordering; descendant-only DOM mutations do not.
   */
  readonly children: React.ReactNode;

  /**
   * Current form action result, used only as a validation trigger.
   *
   * Validation starts on mount and whenever React's dependency comparison
   * detects a changed value. Field messages supply the actual error contents;
   * registration changes alone do not start validation or request focus.
   */
  readonly actionData: unknown;
}

/**
 * Provides a live error registry and validation lifecycle to form descendants.
 *
 * Field messages register errors while mounted and remove them on unmount.
 * Errors follow target DOM order when provider children or registrations change.
 * No DOM observer is installed, and the provider adds no DOM wrapper.
 *
 * Validation starts on mount and when action data changes. Descendant effects
 * register their errors before the pending run is committed. The resulting
 * validation counter lets focus and analytics effects read the current list
 * without repeating those effects for local registration changes.
 *
 * @param children Form content that consumes or contributes to the summary.
 * @param actionData Current action result; a changed value starts a new run.
 * @returns The provider wrapping form content and summary side effects.
 */
export function ErrorSummaryProvider({ children, actionData }: ErrorSummaryProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(errorSummaryReducer, initialErrorSummaryState);
  const summaryId = useId();

  /**
   * Errors in the last committed order, followed by newly registered errors.
   * Known positions remain stable until the layout effect resolves target order.
   */
  const errors = useMemo(() => {
    const orderedErrors = state.orderedErrorIds.flatMap((registrationId) => {
      const error = state.registeredErrors.get(registrationId);
      return error ? [error] : [];
    });
    const orderedIds = new Set(state.orderedErrorIds);
    const unpositionedErrors = [...state.registeredErrors].filter(([registrationId]) => !orderedIds.has(registrationId)).map(([, error]) => error);
    return [...orderedErrors, ...unpositionedErrors];
  }, [state.orderedErrorIds, state.registeredErrors]);

  /**
   * Adds or updates one mounted message's error without starting validation.
   *
   * @param registrationId The stable identity owned by the error component.
   * @param error The current target field and displayed message.
   */
  const registerError = useCallback((registrationId: string, error: NewError) => {
    dispatch({ type: 'REGISTER_ERROR', registrationId, error });
  }, []);

  /**
   * Removes one message's registration and its remembered ordering position.
   * Other messages targeting the same field are unaffected.
   *
   * @param registrationId The identity of the registration to remove.
   */
  const unregisterError = useCallback((registrationId: string) => {
    dispatch({ type: 'UNREGISTER_ERROR', registrationId });
  }, []);

  useLayoutEffect(() => {
    const registrationIds = sortRegisteredErrors(state.registeredErrors);
    dispatch({ type: 'SORT_ERRORS', registrationIds });
  }, [children, state.registeredErrors]);

  useEffect(() => {
    // Mounting and action-data changes start validation; registration changes do not.
    dispatch({ type: 'START_VALIDATION' });
  }, [actionData]);

  /**
   * Completes a pending cycle and advances the validation counter.
   * The reducer ignores calls made when no validation is pending.
   */
  const completeValidation = useCallback(() => {
    dispatch({ type: 'COMPLETE_VALIDATION' });
  }, []);

  /**
   * Shared registry API whose identity remains stable until exposed data changes.
   */
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
