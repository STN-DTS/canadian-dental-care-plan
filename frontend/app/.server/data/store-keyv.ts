import KeyvRedis from '@keyv/redis';
import { Option } from 'effect';
import Keyv, { jsonSerializer, keyvStorageCapability } from 'keyv';
import type { KeyvSerializationAdapter, KeyvStorageAdapter, KeyvStorageEntry, KeyvStorageGetResult } from 'keyv';
import { EventEmitter } from 'node:events';
import QuickLRU from 'quick-lru';

import { getRedisClient } from '~/.server/data/redis-client';
import type { RedisClient } from '~/.server/data/redis-client';
import type { JsonValue, Store, StoreEntry, StoreFindOptions, StoreOptions, StoreTouchEntry } from '~/.server/data/store';

const DEFAULT_MEMORY_MAX_SIZE = 1000;
const NAMESPACE_SEPARATOR = ':';

/**
 * Serializes Keyv envelopes with `expires: null` while Keyv still passes the real `expires`
 * timestamp to the underlying storage adapter (`@keyv/redis` or `QuickLruStorageAdapter`).
 *
 * This keeps mixed-version rolling deployments safe: pods running older code with Keyv's default
 * `checkExpired: true` will not see a stale numeric `expires` timestamp after a newer pod extends
 * the Redis key via `GETEX` or `PEXPIRE`, and therefore will not falsely delete live entries.
 */
const envelopeSerializer: KeyvSerializationAdapter = {
  stringify: (data: unknown) => {
    if (typeof data === 'object' && data !== null && 'value' in data && 'expires' in data) {
      return jsonSerializer.stringify({ ...(data as Record<string, unknown>), expires: null });
    }

    return jsonSerializer.stringify(data);
  },
  parse: <T>(data: string) => jsonSerializer.parse<T>(data),
};

type ResolvedTouchEntry = {
  readonly key: string;
  readonly ttlMs?: number;
  readonly onlyIfGreater?: boolean;
};

type KeyvBackend = {
  readonly keyv: Keyv;
  getEx(key: string, ttlMs: number): Promise<unknown>;
  touch(entries: readonly ResolvedTouchEntry[]): Promise<boolean[]>;
};

type MemoryEntry = {
  readonly value: unknown;
  expiresAt?: number;
};

function toPositiveTtlMs(ttlSeconds: number): number {
  if (!Number.isFinite(ttlSeconds) || ttlSeconds <= 0) {
    throw new RangeError('ttlSeconds must be a finite number greater than 0.');
  }

  return Math.max(1, Math.ceil(ttlSeconds * 1000));
}

/**
 * Keyv v6 storage adapter backed by a dedicated `QuickLRU` instance with mutable per-entry `expiresAt`.
 *
 * Updating `expiresAt` in place avoids calling `lru.set()` during `getEx()` / `touch()`, preventing
 * extra generation rotations and premature LRU evictions, while matching Redis `GETEX` and `PEXPIRE [GT]`.
 */
class QuickLruStorageAdapter extends EventEmitter implements KeyvStorageAdapter {
  readonly namespace?: string;
  readonly capabilities;
  private readonly lru: QuickLRU<string, MemoryEntry>;

  constructor(namespace: string, maxSize: number) {
    super();
    this.namespace = namespace;
    this.lru = new QuickLRU<string, MemoryEntry>({ maxSize });
    this.capabilities = keyvStorageCapability(this);
  }

  private prefixKey(key: string): string {
    return this.namespace ? `${this.namespace}${NAMESPACE_SEPARATOR}${key}` : key;
  }

  private getLiveEntry(key: string, promote: boolean): MemoryEntry | undefined {
    const prefixedKey = this.prefixKey(key);
    const entry = promote ? this.lru.get(prefixedKey) : this.lru.peek(prefixedKey);

    if (entry === undefined) {
      return undefined;
    }

    if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      this.lru.delete(prefixedKey);
      return undefined;
    }

    return entry;
  }

  private setEntry(key: string, value: unknown, expires?: number): boolean {
    const prefixedKey = this.prefixKey(key);

    if (expires !== undefined && expires <= Date.now()) {
      this.lru.delete(prefixedKey);
      return true;
    }

    this.lru.set(prefixedKey, { value, expiresAt: expires });
    return true;
  }

  async get<Value>(key: string): Promise<KeyvStorageGetResult<Value>> {
    return await Promise.resolve(this.getLiveEntry(key, true)?.value as KeyvStorageGetResult<Value>);
  }

  async getMany<Value>(keys: string[]): Promise<Array<KeyvStorageGetResult<Value | undefined>>> {
    return await Promise.resolve(keys.map((key) => this.getLiveEntry(key, true)?.value as KeyvStorageGetResult<Value | undefined>));
  }

  getEx(key: string, ttlMs: number): unknown {
    const entry = this.getLiveEntry(key, true);

    if (entry === undefined) {
      return undefined;
    }

    entry.expiresAt = Date.now() + ttlMs;
    return entry.value;
  }

  touch(key: string, ttlMs?: number, onlyIfGreater?: boolean): boolean {
    const entry = this.getLiveEntry(key, false);

    if (entry === undefined) {
      return false;
    }

    if (ttlMs !== undefined) {
      const nextExpiresAt = Date.now() + ttlMs;

      // Match Redis `PEXPIRE ... GT`: a non-volatile key (undefined) has infinite TTL and is not shortened.
      if (onlyIfGreater && (entry.expiresAt === undefined || nextExpiresAt <= entry.expiresAt)) {
        return false;
      }

      entry.expiresAt = nextExpiresAt;
    }

    return true;
  }

  async set(key: string, value: unknown, expires?: number): Promise<boolean> {
    return await Promise.resolve(this.setEntry(key, value, expires));
  }

  async setMany<Value>(values: KeyvStorageEntry<Value>[]): Promise<boolean[]> {
    return await Promise.resolve(values.map(({ key, value, expires }) => this.setEntry(key, value, expires)));
  }

  async delete(key: string): Promise<boolean> {
    return await Promise.resolve(this.lru.delete(this.prefixKey(key)));
  }

  async deleteMany(keys: string[]): Promise<boolean[]> {
    return await Promise.resolve(keys.map((key) => this.lru.delete(this.prefixKey(key))));
  }

  async clear(): Promise<void> {
    this.lru.clear();
    await Promise.resolve();
  }

  async has(key: string): Promise<boolean> {
    return await Promise.resolve(this.getLiveEntry(key, false) !== undefined);
  }

  async hasMany(keys: string[]): Promise<boolean[]> {
    return await Promise.resolve(keys.map((key) => this.getLiveEntry(key, false) !== undefined));
  }
}

async function touchRedis(client: RedisClient, adapter: KeyvRedis<unknown>, namespace: string, entries: readonly ResolvedTouchEntry[]): Promise<boolean[]> {
  const [firstEntry] = entries;

  if (entries.length === 1 && firstEntry) {
    if (firstEntry.key === '') {
      return [false];
    }

    const prefixedKey = adapter.createKeyPrefix(firstEntry.key, namespace);

    if (firstEntry.ttlMs === undefined) {
      return [(await client.exists(prefixedKey)) === 1];
    }

    const reply = firstEntry.onlyIfGreater ? await client.pExpire(prefixedKey, firstEntry.ttlMs, 'GT') : await client.pExpire(prefixedKey, firstEntry.ttlMs);
    return [reply === 1];
  }

  const nonEmptyEntries = entries.filter(({ key }) => key !== '');

  if (nonEmptyEntries.length === 0) {
    return entries.map(() => false);
  }

  const multi = client.multi();

  for (const { key, ttlMs, onlyIfGreater } of nonEmptyEntries) {
    const prefixedKey = adapter.createKeyPrefix(key, namespace);

    if (ttlMs === undefined) {
      multi.exists(prefixedKey);
    } else if (onlyIfGreater) {
      multi.pExpire(prefixedKey, ttlMs, 'GT');
    } else {
      multi.pExpire(prefixedKey, ttlMs);
    }
  }

  const replies = await multi.exec();
  let replyIndex = 0;

  return entries.map(({ key }) => (key === '' ? false : Number(replies[replyIndex++]) === 1));
}

/**
 * Creates a Keyv instance whose failed operations reject instead of returning fallback values.
 *
 * With an `error` listener attached, Keyv resolves failed operations to `undefined` or `false`, which would
 * make a storage outage look like a missing key. No listener is attached, so failures propagate. The Redis
 * adapter's error forwarding is removed so connection errors emitted outside an operation do not throw from
 * the Redis client's event handler; the shared client already logs them.
 *
 * `checkExpired: false` delegates expiry enforcement to the underlying adapter (Redis TTL or `QuickLruStorageAdapter`)
 * so `GETEX` and `PEXPIRE` extend entry lifetimes without rewriting Keyv's JSON envelope.
 */
async function createBackend(namespace: string, { backend, ttlSeconds, maxSize }: StoreOptions): Promise<KeyvBackend> {
  const ttl = ttlSeconds === undefined ? undefined : toPositiveTtlMs(ttlSeconds);

  if (backend === 'memory') {
    const adapter = new QuickLruStorageAdapter(namespace, maxSize ?? DEFAULT_MEMORY_MAX_SIZE);
    const keyv = new Keyv({ store: adapter, ttl, checkExpired: false, serialization: envelopeSerializer });
    return {
      keyv,
      getEx: async (key, ttlMs) => await Promise.resolve(adapter.getEx(key, ttlMs)),
      touch: async (entries) => await Promise.resolve(entries.map(({ key, ttlMs, onlyIfGreater }) => (key === '' ? false : adapter.touch(key, ttlMs, onlyIfGreater)))),
    };
  }

  const client = await getRedisClient();
  const adapter = new KeyvRedis(client, { namespace, namespaceSeparator: NAMESPACE_SEPARATOR, throwOnErrors: true });
  const keyv = new Keyv({ store: adapter, ttl, checkExpired: false, serialization: envelopeSerializer });
  adapter.removeAllListeners('error');
  return {
    keyv,
    getEx: async (key, ttlMs) => await client.getEx(adapter.createKeyPrefix(key, namespace), { type: 'PX', value: ttlMs }),
    touch: async (entries) => await touchRedis(client, adapter, namespace, entries),
  };
}

/**
 * {@link Store} facade over Keyv. The Redis connection is opened on first use; a failed
 * connection is retried by the next operation.
 */
export class KeyvStore<T extends JsonValue> implements Store<T> {
  private readonly namespace: string;
  private readonly options: StoreOptions;
  private backendPromise?: Promise<KeyvBackend>;

  constructor(namespace: string, options: StoreOptions) {
    this.namespace = namespace;
    this.options = options;
  }

  private async getBackend(): Promise<KeyvBackend> {
    this.backendPromise ??= createBackend(this.namespace, this.options).catch((error: unknown) => {
      this.backendPromise = undefined;
      throw error;
    });
    return await this.backendPromise;
  }

  private resolveExtendTtlMs(extendTtl: boolean | number | undefined): number | undefined {
    if (extendTtl === undefined || extendTtl === false) {
      return undefined;
    }

    const ttlSeconds = typeof extendTtl === 'number' ? extendTtl : this.options.ttlSeconds;
    return ttlSeconds === undefined ? undefined : toPositiveTtlMs(ttlSeconds);
  }

  async find(key: string, options?: StoreFindOptions): Promise<Option.Option<T>> {
    const backend = await this.getBackend();
    const extendTtlMs = this.resolveExtendTtlMs(options?.extendTtl);

    if (extendTtlMs === undefined) {
      return Option.fromUndefinedOr(await backend.keyv.get<T>(key));
    }

    if (key === '') {
      return Option.none();
    }

    const rawData = await backend.getEx(key, extendTtlMs);
    const decoded = await backend.keyv.decode<T>(rawData);
    return Option.fromUndefinedOr(decoded?.value);
  }

  async set(...entries: StoreEntry<T>[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const { keyv } = await this.getBackend();
    const [firstEntry] = entries;

    if (entries.length === 1 && firstEntry) {
      const saved = await keyv.set(firstEntry.key, firstEntry.value, firstEntry.ttlSeconds === undefined ? undefined : toPositiveTtlMs(firstEntry.ttlSeconds));

      if (!saved) {
        throw new Error('Store entries could not be written.');
      }

      return;
    }

    const results = await keyv.setMany(entries.map(({ key, value, ttlSeconds }) => (ttlSeconds === undefined ? { key, value } : { key, value, ttl: toPositiveTtlMs(ttlSeconds) })));

    if (results.includes(false)) {
      throw new Error('Store entries could not be written.');
    }
  }

  async touch(...entries: StoreTouchEntry[]): Promise<boolean[]> {
    if (entries.length === 0) {
      return [];
    }

    const backend = await this.getBackend();
    const resolved = entries.map(({ key, ttlSeconds, onlyIfGreater }) => {
      const effectiveTtlSeconds = ttlSeconds ?? this.options.ttlSeconds;
      return { key, ttlMs: effectiveTtlSeconds === undefined ? undefined : toPositiveTtlMs(effectiveTtlSeconds), onlyIfGreater };
    });

    return await backend.touch(resolved);
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    const { keyv } = await this.getBackend();
    const [firstKey] = keys;

    if (keys.length === 1 && firstKey !== undefined) {
      await keyv.delete(firstKey);
      return;
    }

    await keyv.deleteMany(keys);
  }

  async clear(): Promise<void> {
    await (await this.getBackend()).keyv.clear();
  }

  async has(key: string): Promise<boolean> {
    return await (await this.getBackend()).keyv.has(key);
  }

  async update(key: string, updater: (current: Option.Option<T>) => Option.Option<T>): Promise<Option.Option<T>> {
    const updated = updater(await this.find(key));

    if (Option.isNone(updated)) {
      await this.delete(key);
    } else {
      await this.set({ key, value: updated.value });
    }

    return updated;
  }
}
