import { useMemo } from 'react';

import type { useFetcher } from 'react-router';

const DEFAULT_SUBMIT_ACTION_KEY = '_action';

type FetcherLike = Pick<ReturnType<typeof useFetcher>, 'formData' | 'state'>;

type UseFetcherSubmissionStateResult = {
  /**
   * Whether the fetcher is submitting or loading.
   */
  isSubmitting: boolean;
  /**
   * The string value of the configured action field in the fetcher's form data, when present.
   */
  submitAction?: string;
};

type UseFetcherSubmissionStateOptions = {
  /**
   * The form-data key used to retrieve `submitAction`. Defaults to `_action`.
   */
  submitActionKey?: string;
};

/**
 * Returns submission state derived from a React Router fetcher.
 */
export function useFetcherSubmissionState(fetcher: FetcherLike, options?: UseFetcherSubmissionStateOptions): UseFetcherSubmissionStateResult {
  const isSubmitting = fetcher.state !== 'idle';
  const submitActionKey = options?.submitActionKey ?? DEFAULT_SUBMIT_ACTION_KEY;
  const submitActionValue = fetcher.formData?.get(submitActionKey);
  const submitAction = typeof submitActionValue === 'string' ? submitActionValue : undefined;
  return useMemo(() => ({ isSubmitting, submitAction }), [isSubmitting, submitAction]);
}
