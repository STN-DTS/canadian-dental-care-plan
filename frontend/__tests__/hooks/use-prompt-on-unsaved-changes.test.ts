import { renderHook } from '@testing-library/react';

import { NavigationType, useBlocker } from 'react-router';
import type { Blocker } from 'react-router';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { usePromptOnUnsavedChanges } from '~/hooks/use-prompt-on-unsaved-changes';

vi.mock(import('react-router'), async (importOriginal) => ({
  ...(await importOriginal()),
  useBlocker: vi.fn(),
}));

const blocker: Blocker = { state: 'unblocked', proceed: undefined, reset: undefined, location: undefined };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBlocker).mockReturnValue(blocker);
});

describe('usePromptOnUnsavedChanges', () => {
  it('returns the router blocker for caller-managed confirmation', () => {
    const { result } = renderHook(() => usePromptOnUnsavedChanges(true));

    expect(result.current).toBe(blocker);
  });

  it.each([
    { isDirty: true, nextPathname: '/other', expected: true },
    { isDirty: false, nextPathname: '/other', expected: false },
    { isDirty: true, nextPathname: '/current', expected: false },
  ])('blocks pathname changes only when dirty: $isDirty, $nextPathname', ({ isDirty, nextPathname, expected }) => {
    renderHook(() => usePromptOnUnsavedChanges(isDirty));
    const shouldBlock = vi.mocked(useBlocker).mock.calls[0]?.[0];
    if (typeof shouldBlock !== 'function') throw new Error('Expected a navigation blocker predicate');

    expect(
      shouldBlock({
        currentLocation: { pathname: '/current', search: '?before=1', hash: '#before', state: null, key: 'current' },
        nextLocation: { pathname: nextPathname, search: '?after=1', hash: '#after', state: null, key: 'next' },
        historyAction: NavigationType.Push,
      }),
    ).toBe(expected);
  });

  it('keeps the blocker predicate stable until dirty state changes', () => {
    const { rerender } = renderHook(({ isDirty }) => usePromptOnUnsavedChanges(isDirty), { initialProps: { isDirty: true } });
    const initialPredicate = vi.mocked(useBlocker).mock.calls[0]?.[0];

    rerender({ isDirty: true });
    expect(vi.mocked(useBlocker).mock.lastCall?.[0]).toBe(initialPredicate);

    rerender({ isDirty: false });
    const updatedPredicate = vi.mocked(useBlocker).mock.lastCall?.[0];
    expect(updatedPredicate).not.toBe(initialPredicate);
    if (typeof updatedPredicate !== 'function') throw new Error('Expected a navigation blocker predicate');
    expect(
      updatedPredicate({
        currentLocation: { pathname: '/current', search: '', hash: '', state: null, key: 'current' },
        nextLocation: { pathname: '/other', search: '', hash: '', state: null, key: 'next' },
        historyAction: NavigationType.Push,
      }),
    ).toBe(false);
  });

  it('uses the latest dirty state for browser unloads and the legacy fallback', () => {
    const { rerender } = renderHook(({ isDirty }) => usePromptOnUnsavedChanges(isDirty), { initialProps: { isDirty: false } });

    for (const isDirty of [false, true, false]) {
      rerender({ isDirty });
      const event = new Event('beforeunload', { cancelable: true });
      const setReturnValue = vi.spyOn(event, 'returnValue', 'set');
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(isDirty);
      expect(setReturnValue.mock.calls).toEqual(isDirty ? [[true]] : []);
    }
  });

  it('removes the browser unload handler on unmount', () => {
    const { unmount } = renderHook(() => usePromptOnUnsavedChanges(true));
    unmount();
    const event = new Event('beforeunload', { cancelable: true });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});
