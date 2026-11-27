import { Option } from 'effect';
import * as z from 'zod';

import type { JsonValue, Store, StoreEntry } from '~/.server/data/store';
import { createStore } from '~/.server/data/store-factory';
import { getEnv } from '~/.server/utils/env-utils';

export type SessionStorage<T> = {
  find(sessionId: string, key: string): Promise<Option.Option<T>>;
  set(sessionId: string, key: string, value: T): Promise<void>;
  delete(sessionId: string, key: string): Promise<void>;
};

export type SessionStorageOptions = {
  /** Optional TTL override in seconds for entries in this namespace; defaults to the session store TTL. */
  readonly ttlSeconds?: number;
};

/**
 * Per-session index stored at `SESSION:<sid>:STATE`, mapping each full entry key
 * (`<sid>:STATE:<namespace>:<key>`) to its configured TTL override in seconds, or
 * `null` when the entry uses the session store's default TTL.
 */
const sessionIndexSchema = z.record(z.string(), z.number().positive().nullable());
type SessionIndex = z.infer<typeof sessionIndexSchema>;

const SESSION_STATE_SEGMENT = 'STATE';

function getSessionStore(): Store<JsonValue> {
  const { SESSION_EXPIRES_SECONDS, SESSION_KEY_PREFIX, SESSION_STORAGE_MEMORY_MAX_SIZE, SESSION_STORAGE_TTL_OFFSET_SECONDS, SESSION_STORAGE_TYPE } = getEnv();
  // Shares the base SESSION namespace with connect-redis (SESSION:<sid>). Never call
  // store.clear() on this store: on Redis it scans the namespace and would delete Express sessions too.
  const baseNamespace = SESSION_KEY_PREFIX.replace(/:+$/, '') || 'SESSION';
  return createStore<JsonValue>(baseNamespace, {
    backend: SESSION_STORAGE_TYPE === 'redis' ? 'redis' : 'memory',
    ttlSeconds: SESSION_EXPIRES_SECONDS + SESSION_STORAGE_TTL_OFFSET_SECONDS,
    maxSize: SESSION_STORAGE_MEMORY_MAX_SIZE,
  });
}

function sessionIndexKey(sessionId: string): string {
  return `${encodeURIComponent(sessionId)}:${SESSION_STATE_SEGMENT}`;
}

function sessionEntryKey(sessionId: string, namespace: string, key: string): string {
  return `${sessionIndexKey(sessionId)}:${encodeURIComponent(namespace)}:${encodeURIComponent(key)}`;
}

function parseSessionIndex(value: Option.Option<JsonValue>): SessionIndex {
  const parsed = sessionIndexSchema.safeParse(Option.getOrUndefined(value));
  return parsed.success ? parsed.data : {};
}

/**
 * Creates a lazy, session-scoped storage view for `namespace` backed by the shared
 * Keyv store under the base `SESSION_KEY_PREFIX` namespace (for example
 * `SESSION:<sid>:STATE:<namespace>:<key>`).
 *
 * Calling this function has no side effects; environment settings and the underlying
 * store are resolved on first operation. Every written key is tracked in the
 * per-session index (`SESSION:<sid>:STATE`) so {@link touchSessionStorage} and
 * {@link deleteSessionStorage} can operate across all namespaces without scanning Redis.
 *
 * Index updates are not atomic: concurrent first writes of different keys in the same
 * session can drop one key from the index, in which case that entry expires by TTL
 * instead of being refreshed or deleted with the session.
 */
export function createSessionStorage<T>(namespace: string, options?: SessionStorageOptions): SessionStorage<T> {
  const ttlSeconds = options?.ttlSeconds;

  return {
    async find(sessionId: string, key: string): Promise<Option.Option<T>> {
      const store = getSessionStore();
      const entry = await store.find(sessionEntryKey(sessionId, namespace, key));
      return Option.map(entry, (value) => value as T);
    },

    async set(sessionId: string, key: string, value: T): Promise<void> {
      const store = getSessionStore();
      const entryKey = sessionEntryKey(sessionId, namespace, key);
      await store.set({ key: entryKey, value: value as JsonValue, ttlSeconds });
      // Rewritten on every save so the index TTL never expires before any entry it tracks.
      await store.update(sessionIndexKey(sessionId), (current) => Option.some({ ...parseSessionIndex(current), [entryKey]: ttlSeconds ?? null }));
    },

    async delete(sessionId: string, key: string): Promise<void> {
      const store = getSessionStore();
      await store.delete(sessionEntryKey(sessionId, namespace, key));
    },
  };
}

/**
 * Refreshes the TTL of every still-live entry indexed for `sessionId` using each
 * entry's configured TTL (or the session store default). Expired or deleted entries
 * are pruned from the index; if none remain, the index itself is removed.
 */
export async function touchSessionStorage(sessionId: string): Promise<void> {
  const store = getSessionStore();
  const indexKey = sessionIndexKey(sessionId);
  const trackedEntries = Object.entries(parseSessionIndex(await store.find(indexKey)));

  if (trackedEntries.length === 0) {
    return;
  }

  const loaded = await Promise.all(trackedEntries.map(async ([key, ttlSeconds]) => ({ key, ttlSeconds, value: await store.find(key) })));

  const liveIndex: SessionIndex = {};
  const liveEntries: StoreEntry<JsonValue>[] = [];

  for (const { key, ttlSeconds, value } of loaded) {
    if (Option.isSome(value)) {
      liveIndex[key] = ttlSeconds;
      liveEntries.push({ key, value: value.value, ttlSeconds: ttlSeconds ?? undefined });
    }
  }

  if (liveEntries.length === 0) {
    await store.delete(indexKey);
    return;
  }

  // Rewriting via store.set refreshes both the Keyv envelope expiry and the backend TTL.
  await store.set(...liveEntries, { key: indexKey, value: liveIndex });
}

/**
 * Deletes every entry indexed for `sessionId` across all namespaces,
 * along with the session's index key.
 */
export async function deleteSessionStorage(sessionId: string): Promise<void> {
  const store = getSessionStore();
  const indexKey = sessionIndexKey(sessionId);
  const index = parseSessionIndex(await store.find(indexKey));
  await store.delete(...Object.keys(index), indexKey);
}
