import { renderHook } from '@testing-library/react';

import type { useFetcher } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { useFetcherActionComplete } from '~/hooks/use-fetcher-action-complete';

type FetcherState = ReturnType<typeof useFetcher>['state'];

type FetcherLike<TData> = {
  state: FetcherState;
  data: TData;
};

function createFetcher<TData>(state: FetcherState, data: TData): FetcherLike<TData> {
  return { state, data };
}

describe('useFetcherActionComplete', () => {
  it('should not call onComplete on the initial render when the fetcher is idle', () => {
    const onComplete = vi.fn();

    renderHook(() => useFetcherActionComplete(createFetcher('idle', undefined), onComplete));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should not call onComplete while the fetcher is submitting', () => {
    const onComplete = vi.fn();

    renderHook(() => useFetcherActionComplete(createFetcher('submitting', undefined), onComplete));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should not call onComplete while the fetcher is loading', () => {
    const onComplete = vi.fn();

    renderHook(() => useFetcherActionComplete(createFetcher('loading', undefined), onComplete));

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should call onComplete with the data when the fetcher transitions from submitting to idle with data', () => {
    const onComplete = vi.fn();
    const actionData = { operation: 'add', childNumber: 3 };

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<typeof actionData | undefined>('submitting', undefined) },
    });

    expect(onComplete).not.toHaveBeenCalled();

    rerender({ fetcher: createFetcher<typeof actionData | undefined>('idle', actionData) });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(actionData);
  });

  it('should call onComplete when the fetcher transitions from loading to idle with data', () => {
    const onComplete = vi.fn();
    const actionData = { success: true };

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<typeof actionData | undefined>('loading', undefined) },
    });

    rerender({ fetcher: createFetcher<typeof actionData | undefined>('idle', actionData) });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith(actionData);
  });

  it('should not call onComplete when the fetcher becomes idle without data', () => {
    const onComplete = vi.fn();

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<unknown>('submitting', undefined) },
    });

    rerender({ fetcher: createFetcher<unknown>('idle', undefined) });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should not call onComplete when the fetcher becomes idle with null data', () => {
    const onComplete = vi.fn();

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<unknown>('submitting', undefined) },
    });

    rerender({ fetcher: createFetcher<unknown>('idle', null) });

    expect(onComplete).not.toHaveBeenCalled();
  });

  it('should not call onComplete again on a re-render while the fetcher stays idle with the same data', () => {
    const onComplete = vi.fn();
    const actionData = { operation: 'add' };

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<typeof actionData | undefined>('submitting', undefined) },
    });

    rerender({ fetcher: createFetcher<typeof actionData | undefined>('idle', actionData) });
    expect(onComplete).toHaveBeenCalledTimes(1);

    // A re-render that does not change state or data must not re-trigger the callback.
    rerender({ fetcher: createFetcher<typeof actionData | undefined>('idle', actionData) });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('should call onComplete once per completed submission across multiple cycles', () => {
    const onComplete = vi.fn();
    const firstData = { childNumber: 1 };
    const secondData = { childNumber: 2 };

    const { rerender } = renderHook(({ fetcher }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: { fetcher: createFetcher<typeof firstData | undefined>('submitting', undefined) },
    });

    rerender({ fetcher: createFetcher<typeof firstData | undefined>('idle', firstData) });
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenLastCalledWith(firstData);

    // A second submission cycle.
    rerender({ fetcher: createFetcher<typeof firstData | undefined>('submitting', firstData) });
    rerender({ fetcher: createFetcher<typeof firstData | undefined>('idle', secondData) });

    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete).toHaveBeenLastCalledWith(secondData);
  });

  it('should invoke the latest onComplete callback without re-running for a new callback identity', () => {
    const firstCallback = vi.fn();
    const secondCallback = vi.fn();
    const actionData = { operation: 'add' };

    const { rerender } = renderHook(({ fetcher, onComplete }) => useFetcherActionComplete(fetcher, onComplete), {
      initialProps: {
        fetcher: createFetcher<typeof actionData | undefined>('submitting', undefined),
        onComplete: firstCallback,
      },
    });

    // Swap the callback identity while still busy; this must not trigger a call on its own.
    rerender({ fetcher: createFetcher<typeof actionData | undefined>('submitting', undefined), onComplete: secondCallback });
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).not.toHaveBeenCalled();

    // Completing the submission should call the latest callback only.
    rerender({ fetcher: createFetcher<typeof actionData | undefined>('idle', actionData), onComplete: secondCallback });
    expect(firstCallback).not.toHaveBeenCalled();
    expect(secondCallback).toHaveBeenCalledTimes(1);
    expect(secondCallback).toHaveBeenCalledWith(actionData);
  });
});
