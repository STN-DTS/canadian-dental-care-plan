import KeyvRedis from '@keyv/redis';
import { Option } from 'effect';
import Keyv from 'keyv';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { getRedisClient } from '~/.server/data/redis-client';
import { createStore } from '~/.server/data/store-factory';
import { KeyvStore } from '~/.server/data/store-keyv';

import { FakeRedisClient } from './fake-redis-client';

vi.mock('~/.server/data/redis-client', () => ({ getRedisClient: vi.fn() }));

class FailingRedisClient extends EventEmitter {
  readonly isOpen = true;
  readonly isReady = true;
  readonly connect = vi.fn();
  readonly info = vi.fn().mockResolvedValue('redis_version:7.2.0');
  readonly get = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly getEx = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly pExpire = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly exists = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly set = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly unlink = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly multi = vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    unlink: vi.fn().mockReturnThis(),
    pExpire: vi.fn().mockReturnThis(),
    exists: vi.fn().mockReturnThis(),
    exec: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
  }));
}

describe('KeyvStore', () => {
  it('returns Option.none for missing keys and preserves stored null values', async () => {
    const store = new KeyvStore<string | null>('test-find', { backend: 'memory' });

    await expect(store.find('missing')).resolves.toEqual(Option.none());

    await store.set({ key: 'present', value: 'value' }, { key: 'nullable', value: null });
    await expect(store.find('present')).resolves.toEqual(Option.some('value'));
    await expect(store.find('nullable')).resolves.toEqual(Option.some(null));
  });

  it('updates and deletes values', async () => {
    const store = new KeyvStore<{ count: number }>('test-update', { backend: 'memory' });

    await expect(store.update('key', (current) => Option.some({ count: (Option.getOrUndefined(current)?.count ?? 0) + 1 }))).resolves.toEqual(Option.some({ count: 1 }));
    await expect(store.update('key', (current) => Option.some({ count: (Option.getOrUndefined(current)?.count ?? 0) + 1 }))).resolves.toEqual(Option.some({ count: 2 }));
    await expect(store.update('key', () => Option.none())).resolves.toEqual(Option.none());

    await expect(store.has('key')).resolves.toBe(false);
  });

  it('stores, reads, checks, and deletes values through the Redis backend', async () => {
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore<string | null>('test-redis-roundtrip', { backend: 'redis', ttlSeconds: 60 });

    await store.set({ key: 'a', value: 'hello' }, { key: 'nullable', value: null });

    expect([...client.values.keys()]).toEqual(['test-redis-roundtrip:a', 'test-redis-roundtrip:nullable']);
    await expect(store.find('a')).resolves.toEqual(Option.some('hello'));
    await expect(store.find('nullable')).resolves.toEqual(Option.some(null));
    await expect(store.find('missing')).resolves.toEqual(Option.none());
    await expect(store.has('a')).resolves.toBe(true);

    await store.delete('a');
    expect(client.unlink).toHaveBeenCalledExactlyOnceWith('test-redis-roundtrip:a');
    await expect(store.has('a')).resolves.toBe(false);
    await expect(store.find('a')).resolves.toEqual(Option.none());

    client.multi.mockClear();
    await store.set({ key: 'single', value: 'only-one' });
    expect(client.set).toHaveBeenCalledOnce();
    expect(client.multi).not.toHaveBeenCalled();
    await expect(store.find('single')).resolves.toEqual(Option.some('only-one'));
  });

  it('honors per-entry ttlSeconds overrides', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });

    try {
      const store = new KeyvStore<string>('test-entry-ttl', { backend: 'memory', ttlSeconds: 60 });
      await store.set({ key: 'default', value: 'long' }, { key: 'short', value: 'brief', ttlSeconds: 2 });

      vi.advanceTimersByTime(2_001);

      await expect(store.find('short')).resolves.toEqual(Option.none());
      await expect(store.find('default')).resolves.toEqual(Option.some('long'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('evicts least-recently-used entries in the memory backend once maxSize is exceeded', async () => {
    const store = new KeyvStore<number>('test-lru', { backend: 'memory', maxSize: 2 });

    await store.set({ key: 'a', value: 1 }, { key: 'b', value: 2 });
    // Writing 4 more keys guarantees the oldest generation containing 'a' and 'b' is rotated out.
    await store.set({ key: 'c', value: 3 }, { key: 'd', value: 4 }, { key: 'e', value: 5 });

    await expect(store.find('a')).resolves.toEqual(Option.none());
    await expect(store.find('b')).resolves.toEqual(Option.none());
    await expect(store.find('e')).resolves.toEqual(Option.some(5));
  });

  it('does not trigger premature LRU eviction when extending TTL on find in memory', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });

    try {
      const store = new KeyvStore<number>('test-lru-extend', { backend: 'memory', ttlSeconds: 10, maxSize: 3 });

      // Fill the first generation (rotates into oldCache) and add 2 items to the current generation.
      await store.set({ key: 'k1', value: 1 }, { key: 'k2', value: 2 }, { key: 'k3', value: 3 });
      await store.set({ key: 'k4', value: 4 }, { key: 'k5', value: 5 });

      // Promoting k1 rotates {k4, k5, k1} into oldCache with an empty current generation.
      // Inserting 2 more keys must not rotate oldCache again and evict k4/k5.
      await expect(store.find('k1', { extendTtl: true })).resolves.toEqual(Option.some(1));
      await store.set({ key: 'k6', value: 6 }, { key: 'k7', value: 7 });

      await expect(store.has('k4')).resolves.toBe(true);
      await expect(store.has('k5')).resolves.toBe(true);
      await expect(store.has('k1')).resolves.toBe(true);
      await expect(store.has('k6')).resolves.toBe(true);
      await expect(store.has('k7')).resolves.toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('extends entry TTL on find when extendTtl is enabled in memory', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });

    try {
      const store = new KeyvStore<string | null>('test-extend-memory', { backend: 'memory', ttlSeconds: 4 });
      await store.set({ key: 'default', value: 'hello' }, { key: 'nullable', value: null }, { key: 'short', value: 'brief', ttlSeconds: 2 });

      vi.advanceTimersByTime(3_000);
      await expect(store.find('default', { extendTtl: true })).resolves.toEqual(Option.some('hello'));
      await expect(store.find('nullable', { extendTtl: true })).resolves.toEqual(Option.some(null));
      await expect(store.find('short', { extendTtl: 2 })).resolves.toEqual(Option.none());
      await expect(store.find('missing', { extendTtl: true })).resolves.toEqual(Option.none());

      // Past the original 4s expiry (t=6s), extended entries are still live.
      vi.advanceTimersByTime(3_000);
      await expect(store.find('default')).resolves.toEqual(Option.some('hello'));
      await expect(store.find('nullable')).resolves.toEqual(Option.some(null));

      // Without another extension, entries expire 4s after the t=3s find (at t=7s).
      vi.advanceTimersByTime(1_001);
      await expect(store.find('default')).resolves.toEqual(Option.none());
      await expect(store.find('nullable')).resolves.toEqual(Option.none());
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses Redis GETEX and PEXPIRE to extend TTLs past the original Keyv envelope expiry without rewriting values', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });

    try {
      const client = new FakeRedisClient();
      vi.mocked(getRedisClient).mockResolvedValue(client as never);
      const store = new KeyvStore<string | null>('test-redis-extend', { backend: 'redis', ttlSeconds: 4 });

      await store.set({ key: 'a', value: 'hello' }, { key: 'nullable', value: null });
      const originalEnvelope = client.values.get('test-redis-extend:a');
      client.set.mockClear();
      client.multi.mockClear();

      // At t=3s, find with extendTtl calls GETEX (no GET/SET) and extends expiry to t=7s.
      vi.advanceTimersByTime(3_000);
      await expect(store.find('a', { extendTtl: true })).resolves.toEqual(Option.some('hello'));
      await expect(store.find('nullable', { extendTtl: 6 })).resolves.toEqual(Option.some(null));
      expect(client.getEx).toHaveBeenCalledWith('test-redis-extend:a', { type: 'PX', value: 4_000 });
      expect(client.getEx).toHaveBeenCalledWith('test-redis-extend:nullable', { type: 'PX', value: 6_000 });
      expect(client.set).not.toHaveBeenCalled();

      // Past the original 4s Keyv envelope expiry (t=6s), both entries are still readable.
      vi.advanceTimersByTime(3_000);
      await expect(store.find('a')).resolves.toEqual(Option.some('hello'));
      await expect(store.find('nullable')).resolves.toEqual(Option.some(null));
      // Envelope payload was never rewritten.
      expect(client.values.get('test-redis-extend:a')).toBe(originalEnvelope);

      // Single-key touch uses PEXPIRE without MULTI; multi-key touch batches PEXPIRE via MULTI.
      await expect(store.touch({ key: 'a', ttlSeconds: 5 })).resolves.toEqual([true]);
      expect(client.pExpire).toHaveBeenCalledExactlyOnceWith('test-redis-extend:a', 5_000);
      expect(client.multi).not.toHaveBeenCalled();

      await expect(store.touch({ key: 'a' }, { key: 'missing' })).resolves.toEqual([true, false]);
      expect(client.multi).toHaveBeenCalledOnce();

      // A legacy Keyv reader with default checkExpired: true (e.g. during a rolling deploy) reads extended entries without deleting them.
      const legacyKeyv = new Keyv({ store: new KeyvRedis(client as never, { namespace: 'test-redis-extend', namespaceSeparator: ':' }), checkExpired: true });
      await expect(legacyKeyv.get('a')).resolves.toBe('hello');
      expect(client.unlink).not.toHaveBeenCalled();

      // onlyIfGreater passes GT to Redis PEXPIRE and leaves longer TTLs untouched.
      client.pExpire.mockClear();
      await expect(store.touch({ key: 'a', ttlSeconds: 2, onlyIfGreater: true })).resolves.toEqual([false]);
      expect(client.pExpire).toHaveBeenCalledExactlyOnceWith('test-redis-extend:a', 2_000, 'GT');
      await expect(store.touch({ key: 'a', ttlSeconds: 10, onlyIfGreater: true })).resolves.toEqual([true]);
      expect(client.pExpire).toHaveBeenLastCalledWith('test-redis-extend:a', 10_000, 'GT');
    } finally {
      vi.useRealTimers();
    }
  });

  it('honors onlyIfGreater on touch in memory without shortening longer or non-volatile entries', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });

    try {
      const ttlStore = new KeyvStore<string>('test-touch-gt', { backend: 'memory', ttlSeconds: 10 });
      await ttlStore.set({ key: 'long', value: 'keep', ttlSeconds: 20 });

      await expect(ttlStore.touch({ key: 'long', ttlSeconds: 5, onlyIfGreater: true })).resolves.toEqual([false]);
      vi.advanceTimersByTime(10_000);
      await expect(ttlStore.find('long')).resolves.toEqual(Option.some('keep'));

      await expect(ttlStore.touch({ key: 'long', ttlSeconds: 15, onlyIfGreater: true })).resolves.toEqual([true]);
      vi.advanceTimersByTime(14_000);
      await expect(ttlStore.find('long')).resolves.toEqual(Option.some('keep'));

      const persistentStore = new KeyvStore<string>('test-touch-gt-persistent', { backend: 'memory' });
      await persistentStore.set({ key: 'forever', value: 'stays' });
      await expect(persistentStore.touch({ key: 'forever', ttlSeconds: 5, onlyIfGreater: true })).resolves.toEqual([false]);
      vi.advanceTimersByTime(10_000);
      await expect(persistentStore.find('forever')).resolves.toEqual(Option.some('stays'));
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects non-positive TTL overrides and falls back to plain reads/exists when no TTL is configured', async () => {
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore<string>('test-no-ttl', { backend: 'redis' });

    await store.set({ key: 'a', value: 'hello' });
    await expect(store.find('a', { extendTtl: true })).resolves.toEqual(Option.some('hello'));
    expect(client.getEx).not.toHaveBeenCalled();

    await expect(store.touch({ key: 'a' })).resolves.toEqual([true]);
    expect(client.exists).toHaveBeenCalledExactlyOnceWith('test-no-ttl:a');
    expect(client.pExpire).not.toHaveBeenCalled();

    await expect(store.find('a', { extendTtl: 0 })).rejects.toThrow(RangeError);
    await expect(store.touch({ key: 'a', ttlSeconds: -1 })).rejects.toThrow(RangeError);
  });

  it('rejects failed Redis operations instead of reporting missing keys', async () => {
    const client = new FailingRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore('test-redis-failure', { backend: 'redis', ttlSeconds: 60 });

    await expect(store.find('key')).rejects.toThrow('Redis unavailable');
    await expect(store.find('key', { extendTtl: true })).rejects.toThrow('Redis unavailable');
    await expect(store.touch({ key: 'key' })).rejects.toThrow('Redis unavailable');
    await expect(store.set({ key: 'key', value: 'value' })).rejects.toThrow('Redis unavailable');
  });

  it('does not throw when the Redis client emits an error outside an operation', async () => {
    const client = new FailingRedisClient();
    client.on('error', () => {});
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore('test-redis-event', { backend: 'redis' });
    await expect(store.find('key')).rejects.toThrow();

    expect(() => client.emit('error', new Error('Connection reset'))).not.toThrow();
  });

  it('retries the Redis connection after a failed connection attempt', async () => {
    vi.mocked(getRedisClient)
      .mockRejectedValueOnce(new Error('Connection refused'))
      .mockResolvedValueOnce(new FailingRedisClient() as never);
    const store = new KeyvStore('test-redis-retry', { backend: 'redis' });

    await expect(store.find('key')).rejects.toThrow('Connection refused');
    await expect(store.find('key')).rejects.toThrow('Redis unavailable');
    expect(getRedisClient).toHaveBeenCalledTimes(2);
  });
});

describe('createStore', () => {
  it('returns the same store for the same name and rejects conflicting options', () => {
    const store = createStore('test-factory', { backend: 'memory', ttlSeconds: 60 });

    expect(createStore('test-factory', { backend: 'memory', ttlSeconds: 60 })).toBe(store);
    expect(() => createStore('test-factory', { backend: 'memory', ttlSeconds: 30 })).toThrow('already created with different options');
    expect(() => createStore('test-factory', { backend: 'memory', ttlSeconds: 60, maxSize: 50 })).toThrow('already created with different options');
  });
});
