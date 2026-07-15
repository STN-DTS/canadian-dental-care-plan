/**
 * Error Summary Context — transaction-style error collection
 * ---------------------------------------------------------
 *
 * This context provides a transaction-style buffer for collecting validation
 * errors during a render/validation cycle and committing them in a single
 * update. The pattern prevents the UI from flickering (losing the last
 * committed errors) while new validation runs are in progress.
 *
 * Actions overview:
 * - `START_ERROR_TRANSACTION`: begin collecting errors for the current render; clears
 *   only the internal buffer while leaving the last committed `errors` visible.
 * - `PUSH_ERROR`: append an error to the current transaction buffer.
 * - `COMMIT_ERRORS`: move buffered errors to the visible `errors` list and clear the buffer.
 * - `RESET_ERRORS`: clear both the buffer and the committed `errors` (hide the summary).
 *
 * Typical flow:
 * 1. On new form/action data, dispatch `START_ERROR_TRANSACTION`.
 * 2. Fields call `pushError()` during render/validation.
 * 3. `ErrorSummaryCommitter` calls `commitErrors()` once per render to publish buffered errors.
 * 4. Use `resetErrors()` to clear all visible errors when appropriate (reset, navigation, dismissal).
 */
import type React from 'react';
import { createContext, use, useCallback, useEffect, useLayoutEffect, useMemo, useReducer } from 'react';
import type { JSX } from 'react';

import { generateId } from '~/utils/id.utils';

/**
 * Represents a single error message associated with a form field.
 */
export interface ErrorMessage {
  /**
   * Unique identifier for this error entry.
   */
  id: string;

  /** The unique ID of the input field associated with the error. */
  fieldId: string;

  /** The error message to be displayed. */
  message: string;
}

/** Shape accepted by callers when pushing a new error (no `id` required). */
export type NewError = OmitStrict<ErrorMessage, 'id'>;

/**
 * Error summary state structure: includes all committed errors and
 * a buffer for transaction-based error collection.
 */
interface ErrorSummaryState {
  /** Internal buffer to collect error messages during a transaction. */
  buffer: ErrorMessage[] | null;

  /** List of errors currently presented to the user. */
  errors: ErrorMessage[];

  /** Counter to track the number of validation runs. */
  validationRun: number;
}

const initialErrorSummaryState: ErrorSummaryState = {
  buffer: null,
  errors: [],
  validationRun: 0,
};

/**
 * Error summary context reducer actions.
 */
type ErrorSummaryAction =
  | { type: 'COMMIT_ERRORS' } //
  | { type: 'PUSH_ERROR'; error: ErrorMessage }
  | { type: 'RESET_ERRORS' }
  | { type: 'START_ERROR_TRANSACTION' };

/**
 * Reducer for managing error summary state and buffer.
 */
function errorSummaryReducer(state: ErrorSummaryState, action: ErrorSummaryAction): ErrorSummaryState {
  switch (action.type) {
    case 'COMMIT_ERRORS': {
      if (state.buffer === null) {
        // If buffer is null, we are not currently in a transaction, so there are no errors to commit.
        return state;
      }

      if (areErrorListsEqual(state.errors, state.buffer)) {
        // If the buffer is the same as the currently committed errors, do not update state to avoid
        // unnecessary re-renders.
        return { ...state, buffer: null, validationRun: state.validationRun + 1 };
      }

      // Swap buffer into errors, clear buffer
      return { ...state, errors: state.buffer, buffer: null, validationRun: state.validationRun + 1 };
    }

    case 'PUSH_ERROR': {
      if (state.buffer === null) {
        // If buffer is null, we are not currently in a transaction, so we ignore the error.
        // This can happen if pushError is called outside of a transaction or after a reset.
        return state;
      }

      // Add error to buffer, allowing duplicates (one per field/message pair per render)
      return { ...state, buffer: [...state.buffer, action.error] };
    }

    case 'RESET_ERRORS': {
      // Clear all errors and buffer
      return initialErrorSummaryState;
    }

    case 'START_ERROR_TRANSACTION': {
      // Begin new collection, retain current errors
      return { ...state, buffer: [] };
    }

    default: {
      throw new Error(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        `Unhandled action type: ${(action as any).type}. Valid action types are: \`COMMIT_ERRORS\`, \`PUSH_ERROR\`, \`RESET_ERRORS\`, \`START_ERROR_TRANSACTION\`.`,
      );
    }
  }
}

/**
 * Returns true when buffer is non-null and its entries are exactly equal to errors in the same order (compares fieldId
 * and message). Ignores `id` since buffer entries do not have stable ids until committed.
 */
export function areErrorListsEqual(errors: ErrorMessage[], buffer: ErrorMessage[] | null): boolean {
  if (buffer === null) return false;
  if (buffer.length !== errors.length) return false;
  return buffer.every((b, i) => b.fieldId === errors[i]?.fieldId && b.message === errors[i].message);
}

/**
 * Context value for the Error Summary system.
 */
interface ErrorSummaryContextValue {
  /** List of errors currently displayed to the user. */
  errors: ErrorMessage[];

  /** Commit the buffer to the visible errors list. */
  commitErrors: () => void;

  /** Add a new error to this render's transaction buffer. */
  pushError: (error: NewError) => void;

  /** Immediately clear all errors and buffer. */
  resetErrors: () => void;

  /** Counter to track the number of validation runs. */
  validationRun: number;
}

/**
 * React context for the error summary.
 */
const ErrorSummaryContext = createContext<ErrorSummaryContextValue | undefined>(undefined);

/**
 * Hook to consume the error summary context.
 * @returns The current error summary context value, or `undefined` if not within a provider.
 */
export function useErrorSummaryContext(): ErrorSummaryContextValue | undefined {
  return use(ErrorSummaryContext);
}

/**
 * Props for ErrorSummaryProvider.
 */
interface ErrorSummaryProviderProps {
  /** The children (form/fields) that will have access to the error summary context. */
  children: React.ReactNode;

  /**
   * Data representing the current form action/result.
   * Typical use: triggers a new error collection round when changed.
   */
  actionData: unknown;
}

/**
 * Provides ErrorSummaryContext to children, manages error buffer transactions
 * and error state according to form state via `actionData`.
 *
 * @param children - Descendant components that report errors and/or render the summary.
 * @param actionData - Data used to trigger new error collection rounds.
 */
export function ErrorSummaryProvider({ children, actionData }: ErrorSummaryProviderProps): JSX.Element {
  const [state, dispatch] = useReducer(errorSummaryReducer, initialErrorSummaryState);

  // Start a new error collection transaction each time actionData changes,
  // BUT do not hide/erase the errors that are currently visible (UI does not flicker).
  useLayoutEffect(() => {
    dispatch({ type: 'START_ERROR_TRANSACTION' });
  }, [actionData]);

  /**
   * Add a new error message to the error buffer for this transaction.
   * Typically called by field-level components.
   */
  const pushError = useCallback((error: NewError) => {
    dispatch({ type: 'PUSH_ERROR', error: { ...error, id: generateId() } });
  }, []);

  /** Move all buffered errors to the user-visible errors list (commit the transaction). */
  const commitErrors = useCallback(() => {
    dispatch({ type: 'COMMIT_ERRORS' });
  }, []);

  /** Immediately clear all errors and buffer (removes error summary from UI). */
  const resetErrors = useCallback(() => {
    dispatch({ type: 'RESET_ERRORS' });
  }, []);

  // Memoize the context value for perf and referential stability.
  const contextValue = useMemo<ErrorSummaryContextValue>(
    () => ({
      errors: state.errors,
      pushError,
      commitErrors,
      resetErrors,
      validationRun: state.validationRun,
    }),
    [state.errors, pushError, commitErrors, resetErrors, state.validationRun],
  );

  return (
    <ErrorSummaryContext value={contextValue}>
      {children}
      <ErrorSummaryCommitter />
    </ErrorSummaryContext>
  );
}

/**
 * Internal committer component.
 * Commits the buffer to the visible errors list once per render cycle.
 *
 * Note: It runs after every render (no dependency array), matching the pattern
 *       "collect errors for this render, then commit them."
 *
 * If you later want to restrict how often errors are committed (for perf, animation, etc.)
 * you may add dependencies or switch to manual commits.
 */
function ErrorSummaryCommitter(): JSX.Element | null {
  const errorSummaryContext = useErrorSummaryContext();

  useEffect(() => {
    errorSummaryContext?.commitErrors();
    // Intentionally no dependencies — we attempt to commit after every render.
  });

  return null;
}
