# ADR-0001: Store application state outside the Express session

## Status

Accepted

## Date

2026-11-27

## Context

Public and protected application states were stored as properties on the
Express session object. Express persists that object as a whole, so concurrent
requests can save stale snapshots and overwrite newer application state. The
state is temporary and already has an application-level 20-minute expiry.

The change must clean up state when a session is destroyed or regenerated, and
leave unrelated temporary and authentication state unchanged. Deployments shut
down the application and drop existing Redis sessions, so in-place migration of
legacy Express-session entries is not needed. It does not change the fact that
application state belongs to a browser session rather than a verified person.

## Decision

Store migrated temporary state outside the Express session using three layers:

1. **Generic key-value store (`data/store.ts`, `store-factory.ts`, `store-keyv.ts`)**:
   a small `Store<T>` contract, created by name through `createStore`, with a
   [Keyv](https://keyv.org) implementation. This follows the SIRR-RRAS
   `platform/state/store.ts` pattern without its `cacheable` layer.
2. **Session-scoped storage (`data/session-storage.ts`)**: `createSessionStorage(namespace)`
   returns a lazy storage view backed by a shared Keyv store under the base
   `SESSION_KEY_PREFIX` namespace (default `SESSION`) with a single `:`
   separator, resolving `SESSION_STORAGE_TYPE`, `SESSION_KEY_PREFIX`,
   `SESSION_EXPIRES_SECONDS`, and `SESSION_STATE_TTL_OFFSET_SECONDS` on first
   use to avoid module-import side effects. The backend is Redis when
   `SESSION_STORAGE_TYPE` is `redis`; otherwise it is Keyv's process-local
   memory store. `deleteSessionStorage(sessionId)` cleans up every namespace
   indexed for that session.
3. **Feature storage modules (e.g. `routes/helpers/public-application-state-storage.ts`)**:
   each migrated state has its own storage module built on `createSessionStorage`,
   imported by its route helpers. `Session` keeps its existing synchronous API
   (no `*TemporaryState` methods) plus a write-once `initialize()` method so
   writing to external storage marks an otherwise empty Express session as
   initialized (allowing `express-session` to issue `Set-Cookie` while keeping
   both `saveUninitialized: false` and `resave: false` intact).
   `ExpressSession.destroy()` and `regenerate()` call
   `deleteSessionStorage(id)` so all migrated session storages are cleaned up
   together.

Roll out by state type. Each temporary state or per-session backend cache gets
its own storage module built on `createSessionStorage`: public application
(`public-application-state-storage.ts`), protected application
(`protected-application-state-storage.ts`), status checker
(`status-state-storage.ts`), document upload
(`document-upload-state-storage.ts`), profile email verification
(`profile-email-address-flow-state-storage.ts`), applicant
(`applicant-state-storage.ts`), client application
(`client-application-state-storage.ts`, with a shorter configurable
`CLIENT_APPLICATION_CACHE_TTL_SECONDS` default of 300 seconds and invalidation
after profile updates), program applicant (`program-applicant-state-storage.ts`),
and letters (`letters-state-storage.ts`). Authentication tokens and OIDC handshake values
stay in the Express session, which is therefore written only during login and
OIDC handshakes.

Each state is stored as its own Keyv key
(`SESSION:<sessionId>:STATE:<namespace>:<key>`, using the configured
`SESSION_KEY_PREFIX` base) with a TTL of
`SESSION_EXPIRES_SECONDS + SESSION_STATE_TTL_OFFSET_SECONDS` (default offset
`300` seconds). A per-session index key (`SESSION:<sessionId>:STATE`) lists the
session's scoped keys across all namespaces and is rewritten, refreshing its
TTL, on every save. Destroying or regenerating a session reads the index and
deletes the indexed entries and the index.

No legacy fallback or migration from the Express session is performed because
the application is shut down during deployment and existing Redis sessions are
dropped.

Store operation failures reject. The Keyv instance has no `error` listener, so
Keyv does not convert Redis failures to `undefined` or `false`, which would look
like missing state. The listener that Keyv adds to the Redis adapter is
removed so that Redis client errors outside an operation do not throw from an
event handler; the shared Redis client already logs them.

Application-level expiry checks remain in the public and protected state
helpers and now use `SESSION_EXPIRES_SECONDS` instead of a hardcoded 20-minute
duration.

## Alternatives considered

### Keep state on the Express session

- Pros: no storage abstraction or migration is needed.
- Cons: whole-session saves can replace newer state written by another request.
- Rejected: it retains the observed concurrency risk.

### One Redis hash per session with set-if-absent migration

- Pros: atomic namespace deletion, a shared TTL, and atomic legacy migration
  with `HSETNX`.
- Cons: requires custom Redis commands and a separate in-memory
  implementation; it does not fit a generic key-value store.
- Rejected: Keyv's key-value contract and a shared store abstraction were
  preferred. The atomic migration and atomic index updates are given up.

### Use `cacheable` in front of Keyv

- Pros: matches the SIRR-RRAS facade and adds an in-process cache layer.
- Cons: an extra dependency, and a local cache layer can serve values that
  another instance has already changed.
- Rejected: the facade uses Keyv directly.

### Delete session state by scanning a key prefix

- Pros: no index key to maintain.
- Cons: session cleanup requires scanning Redis keys.
- Rejected: the per-session index avoids scans.

### Store application state in browser storage

- Pros: avoids server-side session writes.
- Cons: exposes sensitive application data to the browser and does not provide
  server-authoritative expiry or cleanup.
- Rejected: application state remains server-side.

## Consequences

- A stale whole-session save can no longer overwrite public or protected
  application state after it has been externalized.
- Writes to the same application flow remain last-write-wins; this decision
  does not add compare-and-swap or versioned writes.
- The index is updated with read-modify-write. Concurrent first writes of
  different keys in one session can drop an index entry. The entry is then not
  removed when the session is destroyed and remains until its TTL expires.
- Each state has its own TTL, refreshed only when that state is saved. The
  application-level 20-minute expiry checks are unchanged.
- The memory backend is process-local and is not suitable for multi-instance
  production deployments.
- Externalizing state does not prevent another person from using an unlocked
  browser that retains the same session cookie.
