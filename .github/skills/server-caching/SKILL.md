---
name: server-caching
description: '**WORKFLOW SKILL** Add or review memoized server functions in the frontend. USE FOR: createMemoized, micro-memoize, cache keys, cache maxSize, *_CACHE_MAX_SIZE or *_CACHE_TTL settings, lookup or health-check caches, cache misses or stale per-user results. DO NOT USE FOR: HTTP cache headers, Redis session storage, browser caching, client-side state.'
---

# Server caching

Applies to `frontend/app/.server/`. Conventions: [CONTRIBUTING](../../../frontend/CONTRIBUTING.md#server-side-caching).
Helper: `frontend/app/.server/utils/memoize-utils.ts`.

## Workflow

1. Use `createMemoized`. Never import `micro-memoize` directly; Oxlint rejects it outside the helper and tests.
2. Choose `maxSize`:
   - No arguments, or one shared entry: `1`.
   - Keyed by request data: a `*_CACHE_MAX_SIZE` setting in `env-utils.ts` and `.env.example`, using `z.coerce.number().int().positive()`.
   - Never `Infinity`. micro-memoize treats it as 1, and the helper throws.
3. Choose the key. Primitives (string, number, boolean, bigint, null, undefined) compare by value. Arrays, objects, dates, functions and `AbortSignal` compare by reference.
   - Map non-primitive arguments to a primitive or a tuple of primitives with `key`. The helper's types require it.
   - Normalize equivalent inputs: sort and de-duplicate lists, use ISO strings for dates.
   - Ignore arguments that never change the result, such as a health-check `AbortSignal` (`key: () => ''`).
   - Include every input that changes the result. Never share per-user results across users.
4. Set `async: true` for promise-returning functions, and `expiresMs` from a TTL setting when entries must expire.
5. Keep side effects outside the cache. Audit, metrics and writes run in the public method on every call. Memoize a private fetch and assign it in `init()`.
6. Test with the real library (no `vi.mock('micro-memoize')`):
   - Equivalent inputs call the dependency once.
   - Different inputs call it again.
   - Side effects run on cache hits.

## Example

```ts
private init(): void {
  const fetchItems = createMemoized(this.fetchItems, {
    maxSize: this.serverConfig.LOOKUP_SVC_ITEM_CACHE_MAX_SIZE,
    async: true,
    expiresMs: 1000 * this.serverConfig.LOOKUP_SVC_ITEM_CACHE_TTL_SECONDS,
    key: (ids) => [...new Set(ids)].toSorted(),
  });
  fetchItems.cache.on('add', () => this.log.debug('Item cache entry created'));
  this.fetchItems = fetchItems;
}
```

## Review checklist

- No direct `micro-memoize` import and no `Infinity` size.
- The key is value-based, normalized and complete.
- Side effects are not cached.
- Tests prove hits, misses and side effects on hits.
