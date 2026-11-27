import KeyvRedis from '@keyv/redis';
import { Option } from 'effect';
import Keyv from 'keyv';

import { getRedisClient } from '~/.server/data/redis-client';
import type { JsonValue, Store, StoreEntry, StoreOptions } from '~/.server/data/store';

/**
 * Creates a Keyv instance whose failed operations reject instead of returning fallback values.
 *
 * With an `error` listener attached, Keyv resolves failed operations to `undefined` or `false`, which would
 * make a storage outage look like a missing key. No listener is attached, so failures propagate. The Redis
 * adapter's error forwarding is removed so connection errors emitted outside an operation do not throw from
 * the Redis client's event handler; the shared client already logs them.
 */
async function createKeyv(namespace: string, { backend, ttlSeconds }: StoreOptions): Promise<Keyv> {
  const ttl = ttlSeconds === undefined ? undefined : ttlSeconds * 1000;

  if (backend === 'memory') {
    return new Keyv({ namespace, namespaceSeparator: ':', ttl });
  }

  const store = new KeyvRedis(await getRedisClient(), { namespace, namespaceSeparator: ':', throwOnErrors: true });
  const keyv = new Keyv({ store, ttl });
  store.removeAllListeners('error');
  return keyv;
}

/**
 * {@link Store} facade over Keyv. The Redis connection is opened on first use; a failed
 * connection is retried by the next operation.
 */
export class KeyvStore<T extends JsonValue> implements Store<T> {
  private readonly namespace: string;
  private readonly options: StoreOptions;
  private keyvPromise?: Promise<Keyv>;

  constructor(namespace: string, options: StoreOptions) {
    this.namespace = namespace;
    this.options = options;
  }

  private async getKeyv(): Promise<Keyv> {
    this.keyvPromise ??= createKeyv(this.namespace, this.options).catch((error: unknown) => {
      this.keyvPromise = undefined;
      throw error;
    });
    return await this.keyvPromise;
  }

  async find(key: string): Promise<Option.Option<T>> {
    return Option.fromUndefinedOr(await (await this.getKeyv()).get<T>(key));
  }

  async set(...entries: StoreEntry<T>[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }

    const results = await (await this.getKeyv()).setMany(entries.map(({ key, value }) => ({ key, value })));

    if (results.includes(false)) {
      throw new Error('Store entries could not be written.');
    }
  }

  async delete(...keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }

    await (await this.getKeyv()).deleteMany(keys);
  }

  async clear(): Promise<void> {
    await (await this.getKeyv()).clear();
  }

  async has(key: string): Promise<boolean> {
    return await (await this.getKeyv()).has(key);
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
