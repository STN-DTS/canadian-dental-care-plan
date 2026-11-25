import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import { createMemoized } from '~/.server/utils/memoize-utils';

describe('createMemoized', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([Number.POSITIVE_INFINITY, Number.NaN, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects maxSize %s', (maxSize) => {
    expect(() => createMemoized((id: string) => id, { maxSize })).toThrow(RangeError);
  });

  it('keeps distinct keys up to maxSize and evicts the least recently used key', () => {
    const fn = vi.fn((id: string) => ({ id }));
    const memoized = createMemoized(fn, { maxSize: 2 });

    memoized('a');
    memoized('b');
    memoized('a');
    memoized('b');

    expect(fn).toHaveBeenCalledTimes(2);

    memoized('c');
    memoized('a');

    expect(fn.mock.calls.map(([id]) => id)).toEqual(['a', 'b', 'c', 'a']);
  });

  it('uses the key function to match equal values passed in new objects', () => {
    const fn = vi.fn((ids: readonly string[]) => ids.length);
    const memoized = createMemoized(fn, { maxSize: 10, key: (ids) => [...new Set(ids)].toSorted() });

    memoized(['b', 'a']);
    memoized(['a', 'b', 'a']);
    memoized(['c']);

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('maps a single primitive key so different arguments share an entry', () => {
    const fn = vi.fn((signal?: AbortSignal) => signal?.aborted ?? false);
    const memoized = createMemoized(fn, { maxSize: 1, key: () => '' });

    memoized(new AbortController().signal);
    memoized(new AbortController().signal);

    expect(fn).toHaveBeenCalledOnce();
  });

  it('expires entries after expiresMs', () => {
    vi.useFakeTimers();
    const fn = vi.fn((id: string) => id);
    const memoized = createMemoized(fn, { maxSize: 10, expiresMs: 1000 });

    memoized('a');
    vi.advanceTimersByTime(1001);
    memoized('a');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('does not cache rejected promises when async', async () => {
    const fn = vi.fn(async (id: string) => {
      await Promise.resolve();

      if (fn.mock.calls.length === 1) {
        throw new Error(`failed ${id}`);
      }

      return id;
    });
    const memoized = createMemoized(fn, { maxSize: 10, async: true });

    await expect(memoized('a')).rejects.toThrow('failed a');
    await expect(memoized('a')).resolves.toBe('a');
    await expect(memoized('a')).resolves.toBe('a');

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('requires a key function only for non-primitive parameters', () => {
    expectTypeOf(createMemoized((id: string, year?: number) => `${id}${year}`, { maxSize: 1 })).parameters.toEqualTypeOf<[id: string, year?: number]>();
    // @ts-expect-error -- arrays are compared by reference, so a key function is required
    createMemoized((ids: string[]) => ids, { maxSize: 1 });
    // @ts-expect-error -- objects are compared by reference, so a key function is required
    createMemoized((date: { year: number }) => date, { maxSize: 1 });
  });
});
