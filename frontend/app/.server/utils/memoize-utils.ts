import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

/**
 * A cache key item that micro-memoize compares by value (SameValueZero).
 */
export type MemoizeKeyItem = string | number | boolean | bigint | null | undefined;

/**
 * A cache key: one primitive, or a tuple of primitives compared item by item.
 */
export type MemoizeKey = MemoizeKeyItem | readonly MemoizeKeyItem[];

type AnyFunction = (...args: any[]) => any;

type HasPrimitiveParameters<Fn extends AnyFunction> = Parameters<Fn> extends readonly MemoizeKeyItem[] ? true : false;

interface CreateMemoizedBaseOptions {
  /**
   * Maximum number of cached keys; the least recently used key is evicted first.
   * Must be a positive safe integer. micro-memoize silently treats `Infinity`
   * and other invalid values as 1, so they are rejected here.
   */
  maxSize: number;

  /**
   * Time to live of each entry, in milliseconds. Omit to keep entries until evicted.
   */
  expiresMs?: number;

  /**
   * Set to `true` for functions returning a promise, so rejected promises are not cached.
   */
  async?: boolean;
}

type CreateMemoizedKeyOption<Fn extends AnyFunction> =
  HasPrimitiveParameters<Fn> extends true
    ? {
        /**
         * Maps the arguments to the cache key. Optional when every parameter is a
         * primitive, which micro-memoize compares by value.
         */
        key?: (...args: Parameters<Fn>) => MemoizeKey;
      }
    : {
        /**
         * Maps the arguments to the cache key. Required because a parameter is an
         * object, array or function, which micro-memoize compares by reference.
         */
        key: (...args: Parameters<Fn>) => MemoizeKey;
      };

/**
 * Options for {@link createMemoized}.
 */
export type CreateMemoizedOptions<Fn extends AnyFunction> = CreateMemoizedBaseOptions & CreateMemoizedKeyOption<Fn>;

/**
 * A function memoized with {@link createMemoized}.
 */
export type MemoizedFunction<Fn extends AnyFunction> = Memoized<Fn, Options<Fn>>;

/**
 * Memoizes a function with a bounded micro-memoize cache.
 *
 * Use this helper instead of importing micro-memoize directly. It requires a
 * finite `maxSize` and, for non-primitive parameters, a `key` function that
 * returns primitives, so cache keys never depend on object identity.
 *
 * @throws {RangeError} When `maxSize` is not a positive safe integer.
 */
export function createMemoized<Fn extends AnyFunction>(fn: Fn, options: CreateMemoizedOptions<Fn>): MemoizedFunction<Fn> {
  const { maxSize, expiresMs, async, key } = options;

  if (!Number.isSafeInteger(maxSize) || maxSize < 1) {
    throw new RangeError(`Memoize maxSize must be a positive safe integer; received ${maxSize}`);
  }

  const memoizeOptions: Options<Fn> = { maxSize };

  if (expiresMs !== undefined) {
    memoizeOptions.expires = expiresMs;
  }

  if (async !== undefined) {
    memoizeOptions.async = async;
  }

  if (key !== undefined) {
    memoizeOptions.transformKey = (args) => {
      const cacheKey = key(...(args as Parameters<Fn>));
      return Array.isArray(cacheKey) ? [...cacheKey] : [cacheKey];
    };
  }

  return memoize(fn, memoizeOptions);
}
