import { renderHook } from '@testing-library/react';

import { describe, expect, it, vi } from 'vitest';

import { useHCaptcha } from '~/hooks/use-hcaptcha';

vi.mock(import('~/hooks/use-client-env'), () => ({
  useClientEnv: vi.fn().mockReturnValue({ HCAPTCHA_SITE_KEY: 'test-site-key' }),
}));

describe('useHCaptcha', () => {
  it('should return sitekey from useClientEnv', () => {
    const { result } = renderHook(() => useHCaptcha());

    expect(result.current.sitekey).toBe('test-site-key');
  });

  it('should return a captchaRef', () => {
    const { result } = renderHook(() => useHCaptcha());

    expect(result.current.captchaRef).toBeDefined();
    expect(result.current.captchaRef.current).toBeNull();
  });

  it('should return an onLoad callback', () => {
    const { result } = renderHook(() => useHCaptcha());

    expect(result.current.onLoad).toBeTypeOf('function');
  });

  it('should call execute() on captchaRef when onLoad is called', () => {
    const { result } = renderHook(() => useHCaptcha());

    const mockExecute = vi.fn();
    Object.assign(result.current.captchaRef, { current: { execute: mockExecute } });

    result.current.onLoad();

    expect(mockExecute).toHaveBeenCalledOnce();
  });

  it('should not throw when onLoad is called and captchaRef is null', () => {
    const { result } = renderHook(() => useHCaptcha());

    // captchaRef.current is null by default
    expect(() => result.current.onLoad()).not.toThrow();
  });
});
