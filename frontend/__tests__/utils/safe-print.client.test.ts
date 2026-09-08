import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { safePrint } from '~/utils/safe-print.client';

/*
 * @vitest-environment jsdom
 */

describe('safePrint', () => {
  const originalPrint = window.print;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      writable: true,
      value: originalPrint,
    });
    vi.restoreAllMocks();
  });

  it('calls onUnavailable when print is not available', () => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      writable: true,
      value: undefined,
    });
    const onUnavailable = vi.fn();

    safePrint(onUnavailable);

    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('does not call onUnavailable when beforeprint event fires', () => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      writable: true,
      value: vi.fn(() => window.dispatchEvent(new Event('beforeprint'))),
    });
    const onUnavailable = vi.fn();

    safePrint(onUnavailable);
    vi.runAllTimers();

    expect(onUnavailable).not.toHaveBeenCalled();
  });

  it('calls onUnavailable after timeout for silent no-op print', () => {
    Object.defineProperty(window, 'print', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    const onUnavailable = vi.fn();

    safePrint(onUnavailable);

    vi.advanceTimersByTime(499);
    expect(onUnavailable).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });

  it('calls onUnavailable and logs when window.print throws', () => {
    const error = new Error('print failed');
    Object.defineProperty(window, 'print', {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        throw error;
      }),
    });
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onUnavailable = vi.fn();

    safePrint(onUnavailable);

    expect(removeEventListenerSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('safePrint: window.print() threw an error.', error);
    expect(onUnavailable).toHaveBeenCalledTimes(1);
  });
});
