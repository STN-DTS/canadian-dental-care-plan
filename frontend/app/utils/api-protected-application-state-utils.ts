import { useCallback } from 'react';

import { useSubmit } from 'react-router';

import type { ApiProtectedApplicationStateAction } from '~/routes/api/protected-application-state';

interface ApiProtectedApplicationStateSubmitFuncArgs {
  action: ApiProtectedApplicationStateAction;
  id: string;
}

/**
 * A custom hook for submitting API requests to the protected application state endpoint.
 */
export function useApiProtectedApplicationState() {
  const rrSubmit = useSubmit();

  /**
   * Submits a request to the protected application state API endpoint.
   *
   * @example
   * submit({ action: ApiProtectedApplicationStateAction.Extend, id: '00000000-0000-0000-0000-000000000000' });
   */
  const submit = useCallback(
    async ({ action, id }: ApiProtectedApplicationStateSubmitFuncArgs) => {
      await rrSubmit(
        { action, id },
        {
          action: '/api/protected-application-state',
          encType: 'application/json',
          method: 'POST',
          navigate: false,
        },
      );
    },
    [rrSubmit],
  );

  return { submit };
}
