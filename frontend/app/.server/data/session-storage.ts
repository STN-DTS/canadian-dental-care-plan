import { Option } from 'effect';

import type { JsonValue, Store } from '~/.server/data/store';
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

function getSessionIndexKey(sessionId: string): string {
  return `${encodeURIComponent(sessionId)}:${SESSION_STATE_SEGMENT}`;
}

function getScopedKey(namespace: string, key: string): string {
  return `${encodeURIComponent(namespace)}:${encodeURIComponent(key)}`;
}

function getEntryKey(sessionId: string, scopedKey: string): string {
  return `${getSessionIndexKey(sessionId)}:${scopedKey}`;
}

/**
 * Creates a lazy, session-scoped storage view for `namespace` backed by the shared
 * Keyv store under the base `SESSION_KEY_PREFIX` namespace (for example
 * `SESSION:<sid>:STATE:<namespace>:<key>`).
 *
 * Calling this function has no side effects; environment settings and the underlying
 * store are resolved on first operation. Every written key is added to a per-session
 * index (`SESSION:<sid>:STATE`) so {@link deleteSessionStorage} can clean up all
 * namespaces for a session at once without scanning Redis.
 *
 * Index updates are not atomic: concurrent first writes of different keys in the same
 * session can drop one key from the index, in which case that entry expires by TTL
 * instead of being deleted with the session.
 */
export function createSessionStorage<T>(namespace: string, options?: SessionStorageOptions): SessionStorage<T> {
  return {
    async find(sessionId: string, key: string): Promise<Option.Option<T>> {
      const store = getSessionStore();
      return Option.map(await store.find(getEntryKey(sessionId, getScopedKey(namespace, key))), (value) => value as T);
    },

    async set(sessionId: string, key: string, value: T): Promise<void> {
      const store = getSessionStore();
      const scopedKey = getScopedKey(namespace, key);
      await store.set({ key: getEntryKey(sessionId, scopedKey), value: value as JsonValue, ttlSeconds: options?.ttlSeconds });
      // Rewritten on every save so the per-session index TTL never ends before an entry's TTL.
      await store.update(getSessionIndexKey(sessionId), (index) => {
        const current = Option.getOrUndefined(index);
        const scopedKeys = Array.isArray(current) ? current.filter((item) => typeof item === 'string') : [];
        return Option.some(scopedKeys.includes(scopedKey) ? scopedKeys : [...scopedKeys, scopedKey]);
      });
    },

    async delete(sessionId: string, key: string): Promise<void> {
      const store = getSessionStore();
      await store.delete(getEntryKey(sessionId, getScopedKey(namespace, key)));
    },
  };
}

/**
 * Deletes every entry indexed for `sessionId` across all session storage namespaces,
 * along with the session's index key.
 */
export async function deleteSessionStorage(sessionId: string): Promise<void> {
  const store = getSessionStore();
  const indexKey = getSessionIndexKey(sessionId);
  const index = Option.getOrUndefined(await store.find(indexKey));
  const scopedKeys = Array.isArray(index) ? index.filter((item) => typeof item === 'string') : [];
  await store.delete(...scopedKeys.map((scopedKey) => getEntryKey(sessionId, scopedKey)), indexKey);
}
