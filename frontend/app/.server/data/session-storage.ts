import { Option } from 'effect';
import * as z from 'zod';

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
  /**
   * When `true`, `find()` refreshes the entry's TTL and concurrently touches the per-session index TTL.
   * Defaults to `false`. Enable for active multi-step flows that should stay alive across read-only
   * requests and repeated validation failures; leave disabled for caches of third-party service data.
   */
  readonly slidingTtl?: boolean;
};

/**
 * Per-session index stored at `SESSION:<sid>:STATE`, mapping each full entry key
 * (`<sid>:STATE:<namespace>:<key>`) to its configured TTL override in seconds, or
 * `null` when the entry uses the session store's default TTL.
 */
const sessionIndexSchema = z.record(z.string(), z.number().positive().nullable());
type SessionIndex = z.infer<typeof sessionIndexSchema>;

const SESSION_STATE_SEGMENT = 'STATE';

function getSessionStoreConfig(): { store: Store<JsonValue>; defaultTtlSeconds: number } {
  const { SESSION_EXPIRES_SECONDS, SESSION_KEY_PREFIX, SESSION_STORAGE_MEMORY_MAX_SIZE, SESSION_STORAGE_TTL_OFFSET_SECONDS, SESSION_STORAGE_TYPE } = getEnv();
  // Shares the base SESSION namespace with connect-redis (SESSION:<sid>). Never call
  // store.clear() on this store: on Redis it scans the namespace and would delete Express sessions too.
  const baseNamespace = SESSION_KEY_PREFIX.replace(/:+$/, '') || 'SESSION';
  const defaultTtlSeconds = SESSION_EXPIRES_SECONDS + SESSION_STORAGE_TTL_OFFSET_SECONDS;
  return {
    defaultTtlSeconds,
    store: createStore<JsonValue>(baseNamespace, {
      backend: SESSION_STORAGE_TYPE === 'redis' ? 'redis' : 'memory',
      ttlSeconds: defaultTtlSeconds,
      maxSize: SESSION_STORAGE_MEMORY_MAX_SIZE,
    }),
  };
}

function resolveIndexTtlSeconds(entryTtls: readonly (number | null | undefined)[], defaultTtlSeconds: number): number | undefined {
  const maxTtl = entryTtls.reduce<number>((max, ttlSeconds) => Math.max(max, ttlSeconds ?? defaultTtlSeconds), defaultTtlSeconds);
  return maxTtl > defaultTtlSeconds ? maxTtl : undefined;
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
 * Pass `{ slidingTtl: true }` to refresh both the entry's TTL and the per-session
 * index TTL on `find()` hits so active flows stay aligned with the rolling Express
 * session. By default (`slidingTtl: false`), reads do not extend entry TTLs.
 *
 * Index updates are not atomic: concurrent first writes of different keys in the same
 * session can drop one key from the index, in which case that entry expires by TTL
 * instead of being refreshed or deleted with the session.
 */
export function createSessionStorage<T>(namespace: string, options?: SessionStorageOptions): SessionStorage<T> {
  const ttlSeconds = options?.ttlSeconds;
  const slidingTtl = options?.slidingTtl ?? false;

  return {
    async find(sessionId: string, key: string): Promise<Option.Option<T>> {
      const { store, defaultTtlSeconds } = getSessionStoreConfig();
      const entryKey = sessionEntryKey(sessionId, namespace, key);

      if (!slidingTtl) {
        const entry = await store.find(entryKey);
        return Option.map(entry, (value) => value as T);
      }

      // Use onlyIfGreater (`PEXPIRE ... GT`) so a shorter-TTL namespace never shortens an index tracking a longer-lived entry.
      const [entry] = await Promise.all([store.find(entryKey, { extendTtl: ttlSeconds ?? true }), store.touch({ key: sessionIndexKey(sessionId), ttlSeconds: resolveIndexTtlSeconds([ttlSeconds], defaultTtlSeconds), onlyIfGreater: true })]);

      return Option.map(entry, (value) => value as T);
    },

    async set(sessionId: string, key: string, value: T): Promise<void> {
      const { store, defaultTtlSeconds } = getSessionStoreConfig();
      const indexKey = sessionIndexKey(sessionId);
      const entryKey = sessionEntryKey(sessionId, namespace, key);
      const index = parseSessionIndex(await store.find(indexKey));
      const updatedIndex: SessionIndex = { ...index, [entryKey]: ttlSeconds ?? null };
      // Rewritten alongside the entry in one batch so the index TTL never expires before any entry it tracks.
      await store.set({ key: entryKey, value: value as JsonValue, ttlSeconds }, { key: indexKey, value: updatedIndex, ttlSeconds: resolveIndexTtlSeconds(Object.values(updatedIndex), defaultTtlSeconds) });
    },

    async delete(sessionId: string, key: string): Promise<void> {
      const { store } = getSessionStoreConfig();
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
  const { store, defaultTtlSeconds } = getSessionStoreConfig();
  const indexKey = sessionIndexKey(sessionId);
  const trackedEntries = Object.entries(parseSessionIndex(await store.find(indexKey)));

  if (trackedEntries.length === 0) {
    return;
  }

  const indexTtlSeconds = resolveIndexTtlSeconds(
    trackedEntries.map(([, ttlSeconds]) => ttlSeconds),
    defaultTtlSeconds,
  );
  const touchResults = await store.touch(...trackedEntries.map(([key, ttlSeconds]) => ({ key, ttlSeconds: ttlSeconds ?? undefined })), { key: indexKey, ttlSeconds: indexTtlSeconds });

  const liveIndex: SessionIndex = {};
  let pruned = false;

  for (const [index, [key, ttlSeconds]] of trackedEntries.entries()) {
    if (touchResults[index]) {
      liveIndex[key] = ttlSeconds;
    } else {
      pruned = true;
    }
  }

  if (!pruned) {
    return;
  }

  if (Object.keys(liveIndex).length === 0) {
    await store.delete(indexKey);
    return;
  }

  await store.set({ key: indexKey, value: liveIndex, ttlSeconds: resolveIndexTtlSeconds(Object.values(liveIndex), defaultTtlSeconds) });
}

/**
 * Deletes every entry indexed for `sessionId` across all namespaces,
 * along with the session's index key.
 */
export async function deleteSessionStorage(sessionId: string): Promise<void> {
  const { store } = getSessionStoreConfig();
  const indexKey = sessionIndexKey(sessionId);
  const index = parseSessionIndex(await store.find(indexKey));
  await store.delete(...Object.keys(index), indexKey);
}
