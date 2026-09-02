import { useEffect, useRef } from 'react';

import type { useFetcher } from 'react-router';

type FetcherState = ReturnType<typeof useFetcher>['state'];

type FetcherLike<TData> = {
  state: FetcherState;
  data: TData;
};

/**
 * Invokes `onComplete` once each time a fetcher finishes a submission and its
 * subsequent revalidation (i.e. it transitions back to `'idle'` while carrying
 * action data).
 *
 * Because the callback runs after the fetcher becomes idle, the loader has
 * already revalidated and the updated UI has been committed. This makes the hook
 * well suited for post-submission side effects—such as moving focus to newly
 * rendered content or announcing a live-region message—that must not rely on
 * inferring the operation from before/after data comparisons. The action itself
 * returns the structured data describing what happened.
 *
 * @param fetcher A fetcher-like object exposing `state` and `data`.
 * @param onComplete Callback invoked with the fetcher's returned action data.
 */
export function useFetcherActionComplete<TData>(fetcher: FetcherLike<TData>, onComplete: (data: NonNullable<TData>) => void): void {
  const previousStateRef = useRef(fetcher.state);

  // Store the onComplete callback in a ref so that the effect always calls the latest version
  // without needing it in the dependency array. Adding it as a dependency would rerun the effect
  // every time the caller passes a new function reference.
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const wasBusy = previousStateRef.current !== 'idle';
    previousStateRef.current = fetcher.state;

    if (wasBusy && fetcher.state === 'idle' && fetcher.data != null) {
      onCompleteRef.current(fetcher.data);
    }
  }, [fetcher.state, fetcher.data]);
}
