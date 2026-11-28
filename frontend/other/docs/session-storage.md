# Session-Scoped Storage

Temporary multi-step flow states and per-session Power Platform caches live outside the Express session in Keyv-backed session-scoped storage. The Express session holds only authentication tokens and OIDC handshake values (`idToken`, `userInfoToken`, `authCodeVerifier`, `authReturnUrl`, `authState`).

## Why state was moved out of the Express session

- Express persists `req.session` as a single object. Concurrent requests can save a stale snapshot and overwrite newer state created by another request (which contributed to unexpected "application state not found" redirects in production alongside a per-request `lastAccessTime` write that dirtied otherwise read-only GETs).
- Keeping temporary state in independent keys eliminates whole-session overwrites while leaving the Express session write-once at login/OIDC handshake (or initial cookie issuance).
- Deployments shut down the application and drop existing Redis sessions, so no in-place migration from legacy Express-session keys is needed.
- External storage does not change the security boundary: state still belongs to a browser session rather than an independently re-verified person.

## Architecture

### 1. Generic key-value store (`app/.server/data/store*.ts`)

- [`store.ts`](../../app/.server/data/store.ts) defines an Effect `Option`-based `Store<T extends JsonValue>` contract (`find`, `set`, `touch`, `delete`, `has`, `update`, `clear`) with optional per-entry `ttlSeconds` on `StoreEntry<T>` / `StoreTouchEntry` and optional `extendTtl` on `StoreFindOptions`. Missing keys return `Option.none()`; stored `null` values remain `Option.some(null)`.
- [`store-factory.ts`](../../app/.server/data/store-factory.ts) exposes `createStore(name, options)`, cached in `globalThis.__instanceRegistry` (`stores`) so the React Router server build and Express server bundle share the same store instances. Requesting an existing name with different options throws.
- [`store-keyv.ts`](../../app/.server/data/store-keyv.ts) implements `KeyvStore<T>` directly over [Keyv](https://keyv.org) (without `cacheable`), using `checkExpired: false`, `expires: null` in the serialized JSON envelope (so mixed-version rolling deployments with older pods running `checkExpired: true` never delete keys whose Redis TTL was extended), and a single `:` `namespaceSeparator` to match existing Redis keys:
  - **Redis backend:** uses `@keyv/redis` with the shared client from `getRedisClient()` and `throwOnErrors: true`. `find(..., { extendTtl })` runs atomic Redis `GETEX ... PX`, and `touch(...)` runs `PEXPIRE` (with optional `GT` via `onlyIfGreater`, batched in `MULTI` for multiple keys) so TTL refreshes never rewrite entry values.
  - **Memory backend:** uses a `QuickLRU`-backed Keyv storage adapter (bounded LRU, default `maxSize: 1000`, configurable via `StoreOptions.maxSize`) that tracks mutable per-entry `expiresAt` in place for expiry and TTL extension without extra LRU insertions.

**Error semantics:** Failed backend operations reject rather than looking like missing keys. No `error` listener is attached to the `Keyv` instance (which would otherwise convert failures to `undefined` or `false`). The `error` listener Keyv attaches to `@keyv/redis` is removed so out-of-band Redis client errors do not throw from event handlers; the shared Redis client already logs them.

### 2. Session-scoped storage (`app/.server/data/session-storage.ts`)

[`createSessionStorage<T>(namespace, options?)`](../../app/.server/data/session-storage.ts) returns a lazy, namespaced storage view backed by one shared Keyv store under the base `SESSION_KEY_PREFIX` namespace (default `SESSION`). Environment variables are resolved on first operation to avoid module-import side effects:

| Environment variable                             | Default    | Purpose                                                 |
| ------------------------------------------------ | ---------- | ------------------------------------------------------- |
| `SESSION_STORAGE_TYPE`                           | `memory`   | Backend (`memory` or `redis`)                           |
| `SESSION_KEY_PREFIX`                             | `SESSION:` | Base Redis prefix shared with `connect-redis`           |
| `SESSION_EXPIRES_SECONDS`                        | `1200`     | Base session lifetime (default storage TTL adds offset) |
| `SESSION_STORAGE_TTL_OFFSET_SECONDS`             | `300`      | Extra Redis TTL buffer above `SESSION_EXPIRES_SECONDS`  |
| `SESSION_STORAGE_MEMORY_MAX_SIZE`                | `1000`     | `QuickLRU` capacity for the memory backend              |
| `SESSION_STORAGE_CLIENT_APPLICATION_TTL_SECONDS` | `300`      | Shorter TTL override for cached client applications     |

**Key layout and cleanup:**

- Express session (`connect-redis`): `SESSION:<sid>`
- Per-session key index: `SESSION:<sid>:STATE`
- State entries: `SESSION:<sid>:STATE:<namespace>:<key>`

Default TTL is `SESSION_EXPIRES_SECONDS + SESSION_STORAGE_TTL_OFFSET_SECONDS` (25 minutes by default). Sliding expiration on read is opt-in via `{ slidingTtl: true }`: when enabled, `find()` concurrently refreshes the entry's TTL (`GETEX` on Redis / in-place expiry update in memory) and extends the per-session index TTL using `onlyIfGreater` (`PEXPIRE ... GT` on Redis, so a shorter-TTL namespace never shortens an index tracking a longer-lived entry). This keeps active multi-step flows aligned with the rolling Express session in a single Redis round-trip even across read-only requests or repeated form validation failures. By default (`slidingTtl: false`), reads do not extend TTLs so caches of third-party service data expire on a fixed TTL.

Every `set` rewrites the per-session index (`{ [entryKey]: ttlSeconds | null }`) so its TTL never expires before its entries. `touchSessionStorage(sessionId)` refreshes all still-live indexed entries via `store.touch(...)` (`PEXPIRE` on Redis) without rewriting values, pruning expired/deleted entries from the index when needed, and `deleteSessionStorage(sessionId)` deletes all indexed entries and the index without scanning Redis.

> **Gotcha:** Because this store shares the base `SESSION` Redis namespace with `connect-redis`, never call `store.clear()` on it — on Redis, `clear()` scans `SESSION:*` and would delete Express sessions too.

### 3. Feature storage modules (`app/.server/routes/data/*-storage.ts`)

Each temporary state or per-session Power Platform cache has its own lazy storage module built on `createSessionStorage`:

| Module                                                                                                         | Namespace               | TTL            | Sliding on `find` | Notes                                                                    |
| -------------------------------------------------------------------------------------------------------------- | ----------------------- | -------------- | ----------------- | ------------------------------------------------------------------------ |
| [`public-application-storage.ts`](../../app/.server/routes/data/public-application-storage.ts)                 | `public-application`    | Session + 300s | Yes               | Public application flow (`lastUpdatedOn` kept as debug metadata)         |
| [`protected-application-storage.ts`](../../app/.server/routes/data/protected-application-storage.ts)           | `protected-application` | Session + 300s | Yes               | Protected application flow (`lastUpdatedOn` kept as debug metadata)      |
| [`status-storage.ts`](../../app/.server/routes/data/status-storage.ts)                                         | `status`                | Session + 300s | Yes               | Public status-checker flow                                               |
| [`document-upload-storage.ts`](../../app/.server/routes/data/document-upload-storage.ts)                       | `document-upload`       | Session + 300s | Yes               | Protected document-upload flow                                           |
| [`profile-email-address-flow-storage.ts`](../../app/.server/routes/data/profile-email-address-flow-storage.ts) | `profile-email-address` | Session + 300s | Yes               | Protected profile email verification flow                                |
| [`applicant-storage.ts`](../../app/.server/routes/data/applicant-storage.ts)                                   | `applicant`             | Session + 300s | No                | Refetched from Power Platform on miss                                    |
| [`program-applicant-storage.ts`](../../app/.server/routes/data/program-applicant-storage.ts)                   | `program-applicant`     | Session + 300s | No                | Refetched from Power Platform on miss                                    |
| [`letters-storage.ts`](../../app/.server/routes/data/letters-storage.ts)                                       | `letters`               | Session + 300s | No                | Refetched and re-cached on download miss                                 |
| [`client-application-storage.ts`](../../app/.server/routes/data/client-application-storage.ts)                 | `client-application`    | 300s override  | No                | Keyed by `applicationYearId ?? 'default'`; cleared after profile updates |

## Express session lifecycle (`app/.server/web/session.ts`)

- `express-session` runs with `saveUninitialized: false`, `resave: false`, and `rolling: true`.
- Each storage module calls `session.initialize()` on write. When `req.session` has no non-reserved keys yet, `ExpressSession.initialize()` sets `__initializedAt` once (`Temporal.Now.instant().toString()`), causing `express-session` to persist the session and send `Set-Cookie`. Subsequent calls are no-ops, so `resave: false` prevents rewriting `req.session` while `rolling: true` + `touch()` refreshes the Redis TTL.
- `ExpressSession.destroy()` and `ExpressSession.regenerate()` call `deleteSessionStorage(id)` so all namespaces for the session are removed together.

## Application-state expiry & metrics

- Flow expiry is enforced uniformly by Keyv/Redis TTL (`SESSION_EXPIRES_SECONDS + SESSION_STORAGE_TTL_OFFSET_SECONDS`). The 5-minute buffer gives in-flight submissions headroom beyond `SESSION_EXPIRES_SECONDS` to persist `submissionInfo` and reach confirmation, while `lastUpdatedOn` is retained as debugging metadata.
- `POST /api/session` (`action: 'extend'`) calls `touchSessionStorage(session.id)` alongside Express session `touch()`, refreshing all live session-storage entries across public and protected flows using their configured TTLs.
- Missing application states increment the bounded `cdcp.application.state.unavailable` counter ([`application-state-metrics.ts`](../../app/.server/observability/application-state-metrics.ts)) with `cdcp.route.id` (from [`matchRouteId`](../../app/.server/utils/server-build-utils.ts)), `cdcp.application.channel`, and `cdcp.application.state.outcome`.

## Browser verification

After building the frontend, run the normal Playwright suite and the separate short-TTL suite from the repository root:

```sh
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend run test:e2e
pnpm --filter @cdcp-rcsd/frontend exec playwright test --config=e2e/session-storage.config.ts
```

The E2E page objects in `frontend/e2e/pages/` cover the public application, status checker, session-timeout dialog, and protected letters page. Add new journey interactions to these page objects rather than duplicating locators in specs.

The short-TTL suite uses the memory backend, mock services, and a 15-second storage TTL. It checks status flows in both languages and compares an extended application with an unextended control after the original TTL. It does not validate Redis expiry or failover.

## Trade-offs & rejected alternatives

- **Last-write-wins per key:** External storage prevents whole-session overwrites, but concurrent writes to the same flow key remain last-write-wins (no compare-and-swap or versioned writes).
- **Non-atomic session index:** The `SESSION:<sid>:STATE` index uses read-modify-write. Concurrent first writes of two different keys in one session can drop one entry from the index; that entry is then removed by TTL instead of by `destroy()`/`regenerate()`.
- **No Redis hash / `HSETNX`:** Rejected in favor of Keyv's generic key-value contract; deployments drop existing Redis sessions so legacy migration is unnecessary.
- **No `cacheable` layer:** Rejected to avoid an extra dependency and stale cross-pod in-process reads.
- **No prefix-scan cleanup:** Rejected to avoid scanning Redis keys on logout/regeneration.
- **Process-local memory backend:** `QuickLRU` bounds memory in local/test environments but is not suitable for multi-instance production deployments.
