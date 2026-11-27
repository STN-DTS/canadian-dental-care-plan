/**
 * Backend-agnostic key-value store contract, implemented with Keyv in `store-factory.ts`.
 */
import type { Option } from 'effect';

/**
 * Values that survive a JSON round-trip, so the in-memory and Redis backends return identical results.
 */
export type JsonValue = string | number | boolean | null | readonly JsonValue[] | { readonly [key: string]: JsonValue | undefined };

export type StoreEntry<T extends JsonValue> = {
  readonly key: string;
  readonly value: T;
};

/**
 * An async key-value store. Keys are scoped to the store's namespace.
 *
 * Failed backend operations reject; they are never reported as missing keys.
 */
export type Store<T extends JsonValue> = {
  /** Deletes every key in the store's namespace. On Redis this scans the namespace. */
  clear(): Promise<void>;

  /** Missing keys are ignored. */
  delete(...keys: string[]): Promise<void>;

  /** Returns `Option.none()` for missing keys and preserves stored `null` values as `Option.some(null)`. */
  find(key: string): Promise<Option.Option<T>>;

  has(key: string): Promise<boolean>;

  /** Overwrites existing keys and refreshes their TTL. */
  set(...entries: StoreEntry<T>[]): Promise<void>;

  /**
   * Reads, transforms, and writes a value. If the updater returns `Option.none()`, the key is deleted.
   *
   * This is a relaxed (non-atomic) read-modify-write. The updater should be a pure function of `current`;
   * concurrent updates to the same key are last-write-wins.
   *
   * @returns The value returned by the updater.
   */
  update(key: string, updater: (current: Option.Option<T>) => Option.Option<T>): Promise<Option.Option<T>>;
};

export type StoreBackend = 'memory' | 'redis';

export type StoreOptions = {
  readonly backend: StoreBackend;

  /** Entries never expire when omitted. */
  readonly ttlSeconds?: number;
};
