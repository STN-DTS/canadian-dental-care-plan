import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { focusOnNextFrame, scheduleNextFrame } from '~/utils/dom-utils';

describe('dom-utils', () => {
  const requestAnimationFrame = vi.fn<(callback: FrameRequestCallback) => number>();
  const cancelAnimationFrame = vi.fn<(frameId: number) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('window', { requestAnimationFrame, cancelAnimationFrame });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('scheduleNextFrame', () => {
    it('should schedule the callback and return a cancellation function', () => {
      const callback = vi.fn();
      requestAnimationFrame.mockReturnValue(42);

      const cancel = scheduleNextFrame(callback);

      expect(requestAnimationFrame).toHaveBeenCalledWith(callback);
      cancel();
      expect(cancelAnimationFrame).toHaveBeenCalledWith(42);
    });
  });

  describe('focusOnNextFrame', () => {
    it('should resolve and focus the element when the animation frame runs', () => {
      const focus = vi.fn();
      const getElement = vi.fn(() => ({ focus }) as unknown as HTMLElement);
      let scheduledCallback: FrameRequestCallback | undefined;
      requestAnimationFrame.mockImplementation((callback) => {
        scheduledCallback = callback;
        return 42;
      });

      focusOnNextFrame(getElement);

      expect(getElement).not.toHaveBeenCalled();
      scheduledCallback?.(100);
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });
  });
});
