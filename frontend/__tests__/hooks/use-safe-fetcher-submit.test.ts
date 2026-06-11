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
  it('should ignore an immediate second submission while the first is pending', async () => {
    let resolveSubmit: (() => void) | undefined;
    const pendingSubmit = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const fetcher = createFetcher();
    vi.mocked(fetcher.submit).mockReturnValueOnce(pendingSubmit);
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    let firstSubmission: Promise<void> | undefined;
    let secondSubmission: Promise<void> | undefined;
    act(() => {
      firstSubmission = result.current.handleSubmit(createSubmitEvent(form));
      secondSubmission = result.current.handleSubmit(createSubmitEvent(form));
    });

    await expect(secondSubmission).resolves.toBeUndefined();
    expect(fetcher.submit).toHaveBeenCalledOnce();

    await act(async () => {
      resolveSubmit?.();
      await firstSubmission;
    });
  });

  it('should remain submitting through asynchronous preparation and fetcher submission', async () => {
    let resolveOnSubmit: ((value: FormData | undefined) => void) | undefined;
    const pendingOnSubmit = new Promise<FormData | undefined>((resolve) => {
      resolveOnSubmit = resolve;
    });
    let resolveSubmit: (() => void) | undefined;
    const pendingSubmit = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const fetcher = createFetcher();
    vi.mocked(fetcher.submit).mockReturnValueOnce(pendingSubmit);
    const onSubmit = vi.fn().mockReturnValue(pendingOnSubmit);
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher, { onSubmit }));

    expect(result.current.isSubmitting).toBe(false);

    let submission: Promise<void> | undefined;
    act(() => {
      submission = result.current.handleSubmit(createSubmitEvent(form));
    });

    expect(result.current.isSubmitting).toBe(true);
    expect(fetcher.submit).not.toHaveBeenCalled();

    await act(async () => {
      resolveOnSubmit?.(undefined);
      await pendingOnSubmit;
    });

    expect(fetcher.submit).toHaveBeenCalledOnce();
    expect(result.current.isSubmitting).toBe(true);

    await act(async () => {
      resolveSubmit?.();
      await submission;
    });

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should release the submission lock when onSubmit rejects', async () => {
    const error = new Error('Preparation failed');
    const fetcher = createFetcher();
    const onSubmit = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher, { onSubmit }));

    await expect(
      act(async () => {
        await result.current.handleSubmit(createSubmitEvent(form));
      }),
    ).rejects.toThrow(error);

    expect(result.current.isSubmitting).toBe(false);
    expect(fetcher.submit).not.toHaveBeenCalled();

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(fetcher.submit).toHaveBeenCalledOnce();
  });

  it('should release the submission lock when fetcher submission rejects', async () => {
    const error = new Error('Submission failed');
    const fetcher = createFetcher();
    vi.mocked(fetcher.submit).mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher));

    await expect(
      act(async () => {
        await result.current.handleSubmit(createSubmitEvent(form));
      }),
    ).rejects.toThrow(error);

    expect(result.current.isSubmitting).toBe(false);

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(fetcher.submit).toHaveBeenCalledTimes(2);
  });

  it.each(['submitting', 'loading'] as const)('should ignore submissions while the fetcher is %s', async (state) => {
    const fetcher = createFetcher();
    fetcher.state = state;
    const onSubmit = vi.fn();
    const form = document.createElement('form');
    const { result } = renderHook(() => useSafeFetcherSubmit(fetcher, { onSubmit }));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(form)));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(fetcher.submit).not.toHaveBeenCalled();
  });

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
