import { Option } from 'effect';
import { EventEmitter } from 'node:events';
import { describe, expect, it, vi } from 'vitest';

import { getRedisClient } from '~/.server/data/redis-client';
import { createStore } from '~/.server/data/store-factory';
import { KeyvStore } from '~/.server/data/store-keyv';

vi.mock('~/.server/data/redis-client', () => ({ getRedisClient: vi.fn() }));

class FailingRedisClient extends EventEmitter {
  readonly isOpen = true;
  readonly isReady = true;
  readonly connect = vi.fn();
  readonly info = vi.fn().mockResolvedValue('redis_version:7.2.0');
  readonly get = vi.fn().mockRejectedValue(new Error('Redis unavailable'));
  readonly multi = vi.fn(() => ({
    set: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    unlink: vi.fn().mockReturnThis(),
    exec: vi.fn().mockRejectedValue(new Error('Redis unavailable')),
  }));
}

class InMemoryRedisClient extends EventEmitter {
  readonly isOpen = true;
  readonly isReady = true;
  readonly connect = vi.fn();
  readonly values = new Map<string, string>();
  readonly info = vi.fn().mockResolvedValue('redis_version:7.2.0');
  readonly get = vi.fn(async (key: string) => await Promise.resolve(this.values.get(key) ?? null));
  readonly exists = vi.fn(async (key: string) => await Promise.resolve(this.values.has(key) ? 1 : 0));
  readonly multi = vi.fn(() => {
    const ops: (() => unknown)[] = [];
    const tx = {
      set: (key: string, value: string) => {
        ops.push(() => {
          this.values.set(key, value);
          return 'OK';
        });
        return tx;
      },
      del: (key: string) => {
        ops.push(() => (this.values.delete(key) ? 1 : 0));
        return tx;
      },
      unlink: (key: string) => {
        ops.push(() => (this.values.delete(key) ? 1 : 0));
        return tx;
      },
      exec: async () => await Promise.resolve(ops.map((op) => op())),
    };
    return tx;
  });
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
    const client = new InMemoryRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore<string | null>('test-redis-roundtrip', { backend: 'redis', ttlSeconds: 60 });

    await store.set({ key: 'a', value: 'hello' }, { key: 'nullable', value: null });

    expect([...client.values.keys()]).toEqual(['test-redis-roundtrip:a', 'test-redis-roundtrip:nullable']);
    await expect(store.find('a')).resolves.toEqual(Option.some('hello'));
    await expect(store.find('nullable')).resolves.toEqual(Option.some(null));
    await expect(store.find('missing')).resolves.toEqual(Option.none());
    await expect(store.has('a')).resolves.toBe(true);

    await store.delete('a');
    await expect(store.has('a')).resolves.toBe(false);
    await expect(store.find('a')).resolves.toEqual(Option.none());
  });

  it('rejects failed Redis operations instead of reporting missing keys', async () => {
    const client = new FailingRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    const store = new KeyvStore('test-redis-failure', { backend: 'redis' });

    await expect(store.find('key')).rejects.toThrow('Redis unavailable');
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
  });
});
