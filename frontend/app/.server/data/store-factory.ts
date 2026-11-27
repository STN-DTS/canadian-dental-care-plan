import type { JsonValue, Store, StoreOptions } from '~/.server/data/store';
import { KeyvStore } from '~/.server/data/store-keyv';
import { singleton } from '~/.server/utils/instance-registry';

/**
 * Returns the store named `name` (also its key namespace). The same name always returns the same store;
 * requesting it again with different options throws.
 */
export function createStore<T extends JsonValue>(name: string, options: StoreOptions): Store<T> {
  const stores = singleton('stores', () => new Map<string, { options: StoreOptions; store: Store<JsonValue> }>());
  const existing = stores.get(name);

  if (existing) {
    if (existing.options.backend !== options.backend || existing.options.ttlSeconds !== options.ttlSeconds || existing.options.maxSize !== options.maxSize) {
      throw new Error(`Store "${name}" was already created with different options.`);
    }

    return existing.store as Store<T>;
  }

  const store = new KeyvStore<T>(name, options);
  stores.set(name, { options, store: store as Store<JsonValue> });
  return store;
}
