import { act, renderHook } from '@testing-library/react';

import type { useFetcher } from 'react-router';

import type HCaptcha from '@hcaptcha/react-hcaptcha';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useHCaptchaFetcherSubmit } from '~/hooks/use-hcaptcha-fetcher-submit';

const mocks = vi.hoisted(() => ({
  useFeature: vi.fn(),
  useHCaptcha: vi.fn(),
}));

vi.mock(import('~/hooks/use-feature'), () => ({ useFeature: mocks.useFeature }));
vi.mock(import('~/hooks/use-hcaptcha'), () => ({ useHCaptcha: mocks.useHCaptcha }));

type FetcherLike = Pick<ReturnType<typeof useFetcher>, 'formData' | 'state' | 'submit'>;

function createFetcher(): FetcherLike {
  return {
    formData: undefined,
    state: 'idle',
    submit: vi.fn().mockResolvedValue(undefined),
  } as FetcherLike;
}

function createSubmitEvent(form: HTMLFormElement): React.SyntheticEvent<HTMLFormElement> {
  return {
    currentTarget: form,
    nativeEvent: { submitter: null },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as React.SyntheticEvent<HTMLFormElement>;
}

function createForm(): HTMLFormElement {
  const form = document.createElement('form');
  const input = document.createElement('input');
  input.name = 'name';
  input.value = 'Ada';
  form.append(input);
  return form;
}

function configureCaptcha() {
  const captcha = {
    execute: vi.fn().mockResolvedValue({ key: 'captcha-key', response: 'captcha-token' }),
    resetCaptcha: vi.fn(),
  } as unknown as HCaptcha;
  const captchaRef: { current: HCaptcha | null } = { current: captcha };

  mocks.useFeature.mockReturnValue(true);
  mocks.useHCaptcha.mockReturnValue({ captchaRef, onLoad: vi.fn(), sitekey: 'test-site-key' });

  return { captcha, captchaRef };
}

describe('useHCaptchaFetcherSubmit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should add the hCaptcha response to the submitted form data', async () => {
    const { captcha } = configureCaptcha();
    const fetcher = createFetcher();
    const { result } = renderHook(() => useHCaptchaFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(createForm())));

    const submittedData = vi.mocked(fetcher.submit).mock.calls[0]?.[0] as FormData;
    expect(submittedData.get('name')).toBe('Ada');
    expect(submittedData.get('h-captcha-response')).toBe('captcha-token');
    expect(captcha.resetCaptcha).toHaveBeenCalledOnce();
  });

  it('should preserve the enriched form data when onSubmit returns undefined', async () => {
    configureCaptcha();
    const fetcher = createFetcher();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useHCaptchaFetcherSubmit(fetcher, { onSubmit }));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(createForm())));

    const callbackData = onSubmit.mock.calls[0]?.[0].data as FormData;
    const submittedData = vi.mocked(fetcher.submit).mock.calls[0]?.[0] as FormData;
    expect(callbackData.get('h-captcha-response')).toBe('captcha-token');
    expect(submittedData).toBe(callbackData);
  });

  it('should reset the captcha instance used for an in-progress execution', async () => {
    const { captcha, captchaRef } = configureCaptcha();
    vi.mocked(captcha.execute).mockImplementationOnce(async () => {
      captchaRef.current = null;
      return await Promise.resolve({ key: 'captcha-key', response: 'captcha-token' });
    });
    const fetcher = createFetcher();
    const { result } = renderHook(() => useHCaptchaFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(createForm())));

    expect(captcha.resetCaptcha).toHaveBeenCalledOnce();
    expect(fetcher.submit).toHaveBeenCalledOnce();
  });

  it('should continue without a token when hCaptcha execution rejects', async () => {
    const { captcha } = configureCaptcha();
    vi.mocked(captcha.execute).mockRejectedValueOnce(new Error('Captcha failed'));
    const fetcher = createFetcher();
    const { result } = renderHook(() => useHCaptchaFetcherSubmit(fetcher));

    await act(async () => await result.current.handleSubmit(createSubmitEvent(createForm())));

    const submittedData = vi.mocked(fetcher.submit).mock.calls[0]?.[0] as FormData;
    expect(submittedData.has('h-captcha-response')).toBe(false);
    expect(captcha.resetCaptcha).toHaveBeenCalledOnce();
    expect(fetcher.submit).toHaveBeenCalledOnce();
  });
});
