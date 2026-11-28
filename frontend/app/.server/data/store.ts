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
  /** Optional per-entry TTL override in seconds; defaults to the store's configured TTL. */
  readonly ttlSeconds?: number;
};

export type StoreFindOptions = {
  /**
   * Extends a live entry's TTL on read without rewriting its value.
   * Pass `true` to use the store's configured TTL, or a positive number of seconds to override it.
   */
  readonly extendTtl?: boolean | number;
};

export type StoreTouchEntry = {
  readonly key: string;
  /** Optional per-entry TTL override in seconds; defaults to the store's configured TTL. */
  readonly ttlSeconds?: number;
  /**
   * When `true`, updates the expiry only if the new TTL is greater than the key's current remaining TTL
   * (Redis `PEXPIRE ... GT` semantics). Non-volatile keys and keys with a longer remaining TTL are left
   * unchanged and report `false`.
   */
  readonly onlyIfGreater?: boolean;
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

  /**
   * Returns `Option.none()` for missing keys and preserves stored `null` values as `Option.some(null)`.
   * Pass `{ extendTtl: true }` or `{ extendTtl: seconds }` to refresh a live entry's TTL on read without rewriting its value.
   */
  find(key: string, options?: StoreFindOptions): Promise<Option.Option<T>>;

  has(key: string): Promise<boolean>;

  /** Overwrites existing keys and refreshes their TTL. */
  set(...entries: StoreEntry<T>[]): Promise<void>;

  /**
   * Refreshes the TTL of existing keys without rewriting their values.
   * Returns a boolean per entry indicating whether the key was touched (or existed when no TTL is applied).
   */
  touch(...entries: StoreTouchEntry[]): Promise<boolean[]>;

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

  /** Maximum number of entries kept by the memory LRU backend. Defaults to 1000. */
  readonly maxSize?: number;
};
