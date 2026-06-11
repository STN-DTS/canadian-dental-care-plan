import { act, renderHook } from '@testing-library/react';

import type { useFetcher } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { useSafeFetcherSubmit } from '~/hooks/use-safe-fetcher-submit';

type FetcherLike = Pick<ReturnType<typeof useFetcher>, 'formData' | 'state' | 'submit'>;

function createFetcher(): FetcherLike {
  return {
    formData: undefined,
    state: 'idle',
    submit: vi.fn().mockResolvedValue(undefined),
  } as FetcherLike;
}

function createSubmitEvent(form: HTMLFormElement, submitter: HTMLElement | null = null): React.SyntheticEvent<HTMLFormElement> {
  return {
    currentTarget: form,
    nativeEvent: { submitter },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.SyntheticEvent<HTMLFormElement>;
}

describe('useSafeFetcherSubmit', () => {
  it('should use the native form method when no method option is provided', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    form.setAttribute('method', 'PUT');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), { encType: 'application/x-www-form-urlencoded', method: 'PUT' });
  });

  it('should default to GET when neither the form nor options provide a method', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), { encType: 'application/x-www-form-urlencoded', method: 'GET' });
  });

  it('should preserve a relative native form action', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    form.setAttribute('action', '../confirm');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), {
      action: '../confirm',
      encType: 'application/x-www-form-urlencoded',
      method: 'GET',
    });
  });

  it('should use the native form encoding when no encType option is provided', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    form.setAttribute('enctype', 'multipart/form-data');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), { encType: 'multipart/form-data', method: 'GET' });
  });

  it('should prefer submitter overrides over native form options', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    form.setAttribute('action', '/form-action');
    form.setAttribute('enctype', 'application/x-www-form-urlencoded');
    form.setAttribute('method', 'POST');
    const submitter = document.createElement('button');
    submitter.setAttribute('formaction', '/submitter-action');
    submitter.setAttribute('formenctype', 'multipart/form-data');
    submitter.setAttribute('formmethod', 'DELETE');
    form.append(submitter);
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form, submitter)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), {
      action: '/submitter-action',
      encType: 'multipart/form-data',
      method: 'DELETE',
    });
  });

  it('should prefer explicit options and forward unrelated fetcher options', async () => {
    const fetcher = createFetcher();
    const form = document.createElement('form');
    form.setAttribute('action', '/form-action');
    form.setAttribute('enctype', 'multipart/form-data');
    form.setAttribute('method', 'POST');
    const { result } = renderHook(() =>
      useSafeFetcherSubmit(fetcher, {
        action: '/option-action',
        defaultShouldRevalidate: false,
        encType: 'text/plain',
        method: 'PATCH',
        preventScrollReset: true,
        relative: 'path',
      }),
    );

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledWith(expect.any(FormData), {
      action: '/option-action',
      defaultShouldRevalidate: false,
      encType: 'text/plain',
      method: 'PATCH',
      preventScrollReset: true,
      relative: 'path',
    });
  });
});
