import { useMemo } from 'react';

import type { useFetcher } from 'react-router';

const DEFAULT_SUBMIT_ACTION_KEY = '_action';

type FetcherLike = Pick<ReturnType<typeof useFetcher>, 'formData' | 'state'>;

type FetcherState = {
  /**
   * Indicates whether the fetcher is currently submitting a form.
   * This is true when the fetcher's state is not 'idle'.
   */
  isSubmitting: boolean;
  /**
   * The value of the submit action, which is retrieved from the fetcher's form data using the specified key
   * (defaulting to '_action'). This can be used to determine which action is being performed when a form is submitted.
   */
  submitAction?: string;
};

type UseFetcherOptions = {
  /**
   * The key used to retrieve the submit action from the fetcher's form data. Defaults to '_action'.
   */
  submitActionKey?: string;
};

/**
 * Returns normalized state derived from a React Router fetcher.
 *
 * This helper exposes:
 * - `isSubmitting`: whether the fetcher is not currently in the `'idle'` state.
 * - `submitAction`: the action value from `formData` for the provided key
 *   (default: `'_action'`), when present and string-based.
 *
 * @param fetcher A fetcher-like object containing only `state` and `formData`.
 * @param options Optional configuration for submit action extraction.
 */
export function useFetcherSubmissionState(fetcher: FetcherLike, options?: UseFetcherOptions): FetcherState {
  const submitActionKey = options?.submitActionKey ?? DEFAULT_SUBMIT_ACTION_KEY;
  return useMemo(() => {
    const isSubmitting = fetcher.state !== 'idle';
    const submitActionValue = fetcher.formData?.get(submitActionKey);
    const submitAction = typeof submitActionValue === 'string' ? submitActionValue : undefined;
    return { isSubmitting, submitAction };
  }, [fetcher.state, fetcher.formData, submitActionKey]);
}
