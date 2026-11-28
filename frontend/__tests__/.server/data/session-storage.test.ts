import { Option } from 'effect';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { getRedisClient } from '~/.server/data/redis-client';
import { createSessionStorage, deleteSessionStorage, touchSessionStorage } from '~/.server/data/session-storage';
import { getEnv } from '~/.server/utils/env-utils';
import type { ServerEnv } from '~/.server/utils/env-utils';
import { deleteSingleton } from '~/.server/utils/instance-registry';

import { FakeRedisClient } from './fake-redis-client';

vi.mock(import('~/.server/data/redis-client'), () => ({ getRedisClient: vi.fn() }));
vi.mock(import('~/.server/utils/env-utils'), () => ({ getEnv: vi.fn() }));

describe('session-storage', () => {
  beforeEach(() => {
    deleteSingleton('stores');
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 10,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    deleteSingleton('stores');
  });

  it('does not read env or initialize storage until an operation runs', () => {
    createSessionStorage('lazy-namespace');

    expect(getEnv).not.toHaveBeenCalled();
  });

  it('isolates entries by session and namespace', async () => {
    const publicStorage = createSessionStorage<{ value: string }>('public-application');
    const protectedStorage = createSessionStorage<{ value: string }>('protected-application');

    await publicStorage.set('session-a', 'flow-1', { value: 'public-a' });
    await publicStorage.set('session-b', 'flow-1', { value: 'public-b' });
    await protectedStorage.set('session-a', 'flow-1', { value: 'protected-a' });

    await expect(publicStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'public-a' }));
    await expect(publicStorage.find('session-b', 'flow-1')).resolves.toEqual(Option.some({ value: 'public-b' }));
    await expect(protectedStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'protected-a' }));
  });

  it('does not confuse session IDs, namespaces, or keys containing the separator', async () => {
    const storageA = createSessionStorage<{ value: string }>('ns:a');
    const storageB = createSessionStorage<{ value: string }>('ns');

    await storageA.set('session:1', 'key', { value: 'first' });

    await expect(storageB.find('session', '1:ns:a:key')).resolves.toEqual(Option.none());
    await expect(storageB.find('session:1', 'a:key')).resolves.toEqual(Option.none());
  });

  it('expires entries after SESSION_EXPIRES_SECONDS plus SESSION_STORAGE_TTL_OFFSET_SECONDS without extending on find by default', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'redis',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 1,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 2,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
    const storage = createSessionStorage<{ value: string }>('applicant');

    await storage.set('session-a', 'flow-1', { value: 'temporary' });
    vi.advanceTimersByTime(2_999);
    await expect(storage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'temporary' }));
    expect(client.getEx).not.toHaveBeenCalled();
    expect(client.pExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2);
    await expect(storage.find('session-a', 'flow-1')).resolves.toEqual(Option.none());
  });

  it('extends entry and session index TTLs on find when slidingTtl is enabled', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'redis',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 2,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 1,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
    const storage = createSessionStorage<{ value: string }>('public-application', { slidingTtl: true });

    await storage.set('sid-1', 'flow-1', { value: 'active' });

    // Reading at t=2s extends both the entry (GETEX) and per-session index (PEXPIRE GT) concurrently to t=5s.
    vi.advanceTimersByTime(2_000);
    await expect(storage.find('sid-1', 'flow-1')).resolves.toEqual(Option.some({ value: 'active' }));
    expect(client.getEx).toHaveBeenCalledExactlyOnceWith('SESSION:sid-1:STATE:public-application:flow-1', { type: 'PX', value: 3_000 });
    expect(client.pExpire).toHaveBeenCalledExactlyOnceWith('SESSION:sid-1:STATE', 3_000, 'GT');

    // Reading a missing session returns Option.none without creating an index key.
    await expect(storage.find('sid-missing', 'flow-1')).resolves.toEqual(Option.none());
    expect(client.values.has('SESSION:sid-missing:STATE')).toBe(false);

    // At t=4s (past the original 3s TTL), the entry is still alive and indexed for session deletion.
    vi.advanceTimersByTime(2_000);
    await expect(storage.find('sid-1', 'flow-1')).resolves.toEqual(Option.some({ value: 'active' }));

    await deleteSessionStorage('sid-1');
    expect([...client.values.keys()]).toEqual([]);
  });

  it('does not shorten the per-session index TTL on sliding find when another entry has a longer TTL', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'redis',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 2,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 1,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );

    const flowStorage = createSessionStorage<{ value: string }>('public-application', { slidingTtl: true });
    const longStorage = createSessionStorage<{ value: string }>('client-application', { ttlSeconds: 10 });

    await flowStorage.set('sid-1', 'flow-1', { value: 'short-flow' });
    await longStorage.set('sid-1', 'default', { value: 'long-entry' });

    // Reading the shorter-TTL flow at t=1s must not shrink the index from t=10s down to t=4s.
    vi.advanceTimersByTime(1_000);
    await expect(flowStorage.find('sid-1', 'flow-1')).resolves.toEqual(Option.some({ value: 'short-flow' }));

    // At t=5s (past t=4s), the flow expired but the longer entry and index must still be live and removable together.
    vi.advanceTimersByTime(4_000);
    await expect(longStorage.find('sid-1', 'default')).resolves.toEqual(Option.some({ value: 'long-entry' }));
    await deleteSessionStorage('sid-1');
    expect([...client.values.keys()]).toEqual([]);
  });

  it('honors a per-namespace ttlSeconds override independently of the session TTL', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    const defaultStorage = createSessionStorage<{ value: string }>('public-application');
    const shortStorage = createSessionStorage<{ value: string }>('client-application', { ttlSeconds: 2 });

    await defaultStorage.set('session-a', 'flow-1', { value: 'long' });
    await shortStorage.set('session-a', 'default', { value: 'short' });

    vi.advanceTimersByTime(2_001);

    await expect(shortStorage.find('session-a', 'default')).resolves.toEqual(Option.none());
    await expect(defaultStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'long' }));
  });

  it('touches live entries using their configured TTL and prunes expired entries from the index', async () => {
    vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z').epochMilliseconds });
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'memory',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 4,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 2,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );
    const defaultStorage = createSessionStorage<{ value: string }>('public-application');
    const shortStorage = createSessionStorage<{ value: string }>('client-application', { ttlSeconds: 3 });

    await defaultStorage.set('session-a', 'flow-1', { value: 'keep' });
    await shortStorage.set('session-a', 'default', { value: 'short' });

    // At t=2s, both are live; touching resets defaultStorage to t+6s (8s) and shortStorage to t+3s (5s).
    vi.advanceTimersByTime(2_000);
    await touchSessionStorage('session-a');

    // At t=5.001s, shortStorage has expired (3s after touch), while defaultStorage is still alive past its original 6s TTL (at t=7s).
    vi.advanceTimersByTime(3_001);
    await expect(shortStorage.find('session-a', 'default')).resolves.toEqual(Option.none());
    vi.advanceTimersByTime(2_000);
    await expect(defaultStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'keep' }));

    // Touching again extends defaultStorage past t=8s and prunes the expired short entry.
    await touchSessionStorage('session-a');
    vi.advanceTimersByTime(2_000);
    await expect(defaultStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.some({ value: 'keep' }));
  });

  it('stores Redis keys under SESSION_KEY_PREFIX with the SESSION:<sid>:STATE:<namespace>:<key> layout', async () => {
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'redis',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 10,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );

    const storage = createSessionStorage<{ value: string }>('public-application');
    await storage.set('sid-1', 'flow-1', { value: 'hello' });

    expect(client.multi).toHaveBeenCalledOnce();
    expect([...client.values.keys()]).toEqual(['SESSION:sid-1:STATE:public-application:flow-1', 'SESSION:sid-1:STATE']);

    await deleteSessionStorage('sid-1');
    expect([...client.values.keys()]).toEqual([]);
  });

  it('prunes deleted entries from the index and removes the index when no live entries remain on touch', async () => {
    const client = new FakeRedisClient();
    vi.mocked(getRedisClient).mockResolvedValue(client as never);
    vi.mocked(getEnv).mockReturnValue(
      mock<ServerEnv>({
        SESSION_STORAGE_TYPE: 'redis',
        SESSION_KEY_PREFIX: 'SESSION:',
        SESSION_EXPIRES_SECONDS: 60,
        SESSION_STORAGE_TTL_OFFSET_SECONDS: 10,
        SESSION_STORAGE_MEMORY_MAX_SIZE: 1000,
      }),
    );

    const storage = createSessionStorage<{ value: string }>('public-application');
    await storage.set('sid-1', 'flow-1', { value: 'one' });
    await storage.set('sid-1', 'flow-2', { value: 'two' });

    // Touching when all entries are live refreshes TTLs via PEXPIRE without rewriting values or the index.
    client.set.mockClear();
    await touchSessionStorage('sid-1');
    expect(client.set).not.toHaveBeenCalled();

    await storage.delete('sid-1', 'flow-1');

    await touchSessionStorage('sid-1');
    expect(JSON.parse(client.values.get('SESSION:sid-1:STATE') ?? '{}').value).toEqual({
      'sid-1:STATE:public-application:flow-2': null,
    });

    await storage.delete('sid-1', 'flow-2');
    await touchSessionStorage('sid-1');
    expect([...client.values.keys()]).toEqual([]);
  });

  it('deletes a single entry without affecting other entries in the session', async () => {
    const storage = createSessionStorage<{ value: number }>('public-application');
    await storage.set('session-a', 'first', { value: 1 });
    await storage.set('session-a', 'second', { value: 2 });

    await storage.delete('session-a', 'first');

    await expect(storage.find('session-a', 'first')).resolves.toEqual(Option.none());
    await expect(storage.find('session-a', 'second')).resolves.toEqual(Option.some({ value: 2 }));
  });

  it('deletes every indexed entry across namespaces for one session without affecting other sessions', async () => {
    const publicStorage = createSessionStorage<{ value: number }>('public-application');
    const protectedStorage = createSessionStorage<{ value: number }>('protected-application');

    await publicStorage.set('session-a', 'flow-1', { value: 1 });
    await protectedStorage.set('session-a', 'flow-2', { value: 2 });
    await publicStorage.set('session-b', 'flow-1', { value: 3 });

    await deleteSessionStorage('session-a');

    await expect(publicStorage.find('session-a', 'flow-1')).resolves.toEqual(Option.none());
    await expect(protectedStorage.find('session-a', 'flow-2')).resolves.toEqual(Option.none());
    await expect(publicStorage.find('session-b', 'flow-1')).resolves.toEqual(Option.some({ value: 3 }));
  });
});
