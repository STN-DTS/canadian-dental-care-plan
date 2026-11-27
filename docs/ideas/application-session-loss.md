# Reduce unexpected application session loss

## Problem statement

How might we reduce unexpected loss of application state during active public
and protected application journeys, using low-risk changes that can ship in the
December release?

## Evidence

- A 72-hour production export contained 16,165 "state not found" warnings and
  67 "state expired" warnings. Warning counts are not affected-user counts.
- The logged URL was the redirect destination, so the export cannot show where
  in the journey state was missing.
- A local reproduction showed that a stale concurrent request can save an older
  whole session after a newer request created application state, erasing it.
  Production frequency is unknown.
- A successful external submission can cross the 20-minute state-expiry check
  before `submissionInfo` is saved, so the user may not see confirmation.
- The browser timeout can be reset by navigation, while application-state
  expiry is refreshed only when state is saved.

## Recommended direction

The initial recommendation was to ship a small reliability package without
redesigning application-state storage. A later approved follow-up moves
application state into session-scoped server-side storage, starting with public
application state; see the decision record below.

1. Add an approved bounded metric for missing and expired application state.
2. Save `submissionInfo` after a successful submission, even if the expiry
   threshold was crossed while waiting for the external service.
3. Remove the unused per-request `lastAccessTime` session write. Unchanged
   sessions are still touched, so Redis TTL is refreshed without rewriting the
   whole session.
4. Align client timeout behavior with server-side application-state expiry.

This addresses known loss mechanisms while measuring whether more substantial
storage changes are needed later.

## MVP scope

### Metric

- Count missing and expired application state at the existing helper branches.
- Attributes, subject to approval: React Router route ID (for example,
  `public/application/$id/full-adult/marital-status`), `public` or `protected`
  channel, and `missing` or `expired` outcome.
- Use the route ID rather than the route template. The ID is the same in
  English and French, so each page has one value.
- Do not record session IDs, application IDs, or URL paths as metric
  attributes. Each distinct value creates a separate time series. Those values
  belong in logs and traces; see the logging-policy follow-up.
- Add a test that asserts the complete attribute set.

### Successful submission persistence

- After the external submission succeeds, persist `submissionInfo` without
  applying the ordinary 20-minute expiry rejection.
- Test a submission that starts just before expiry and completes after it.
- Confirm the user reaches confirmation and earlier steps still redirect there.

### Session overwrite reduction

- Remove the unused per-request `lastAccessTime` write from
  `frontend/app/.server/express-server/app-context.ts`.
- `session.set()` changes the request-local session. `express-session` detects
  that mutation at response end and automatically saves the full session to the
  store. Because `getAppContext()` runs for each request, this write makes
  otherwise read-only GETs eligible for full-session saves. A stale concurrent
  request can therefore replace a newer session snapshot and erase its
  application state.
- Removing this write prevents it from making ordinary GETs look modified; it
  does not prevent other middleware or route code from modifying the session.
- Verify that an unchanged GET uses store `touch`, not a full session `set`.
- Verify that Redis TTL is extended through `EXPIRE`.
- Add a regression test for a stale read completing after application state
  is created.
- Confirm CSRF and multi-tab behavior do not cause a different full-session
  write that reopens the race.

### Timeout alignment

- Ensure the timeout prompt appears before application state expires.
- Ensure extension refreshes application-state expiry.
- Pass the active locale to extension requests instead of using English.
- Handle hidden or background tabs safely when users return after expiry.
- Keep one effective timeout controller for protected application routes.

## Key assumptions to validate

- [ ] With no other session mutations, removing `lastAccessTime` prevents
      ordinary GETs from triggering full-session writes. Verify with a
      request-level session-store test.
- [ ] The route ID is available where missing and expired state are detected.
      Verify with request context or an explicit route identifier.
- [ ] The metric distinguishes route-specific trends. Compare its outcomes
      with application starts or route traffic after release.
- [ ] Remaining missing state is not dominated by concurrency after these
      changes. Use the metric and December traces to decide whether storage
      changes are needed.

## Success criteria

- Missing state on review and confirmation routes decreases after release.
- Successful submissions crossing the expiry threshold show confirmation.
- Unchanged requests no longer rewrite the whole session.
- Missing and expired state remains visible by route without restoring noisy
  warnings.
- An increase in the expired share is acceptable if warnings and extensions
  replace silent loss.

## Not doing

- Recovery pages or redirect copy changes: removed from this direction.
- Raising session or application-state TTLs: this hides timing defects and
  extends exposure.
- Automatic submission retries: these increase duplicate-submission risk.
- Explicit `session.save()` calls before redirects: the race occurs when a stale
  request saves later, not because the creating request failed to save.
- Optimistic concurrency or versioned writes: the session-scoped store avoids
  whole-session overwrites but does not prevent concurrent writes to the same
  application state.
- Moving other temporary or authentication state out of the Express session:
  only public application state is in scope for the first slice; protected
  application state is planned next.
- CSRF session-creation changes: separately security-sensitive.
- Cache-header changes: affects back-button behavior without targeting the
  known loss mechanisms.
- Logging headers, query strings, or whole request objects: not needed for
  this diagnosis.

## Follow-up: logging policy

Recording session IDs, application IDs, and URL paths without query strings
in logs and traces is acceptable. Session IDs provide cross-request correlation
that trace IDs cannot. The session cookie is signed, so a logged session ID
alone cannot be used to reuse a session without the cookie secret.

The repository logging policy currently prohibits raw session IDs and raw URLs:

- `.github/skills/logging/SKILL.md`
- `.github/skills/logging/references/sensitive-data.md`
- `.github/skills/logging/references/events.md`

Update that policy in a separate change before relying on these fields. Until
then, agents following it will remove or avoid them. The update should:

- Allow session IDs, application IDs, and URL paths without query strings in
  logs and traces.
- Keep query strings, headers, cookies, tokens, and whole request objects
  prohibited.
- Keep these values out of metric attributes because of cardinality.

## Open questions

- Who approves the metric name and the three bounded attributes?
- Which route-ID source is available at the detection point?
- Is a matching application-start metric needed to compare loss rates?

## Follow-up: session-scoped application-state storage

The approved follow-up stores temporary state outside the Express session,
using a Keyv-backed store keyed by session ID and state key. Redis is used when
`SESSION_STORAGE_TYPE` is `redis`; otherwise state is held in process memory.
A per-session index lets session destruction and regeneration delete the
session's states without scanning Redis.

The first iteration moves only public application state. Protected application
state stays in the Express session until the next iteration. No legacy
migration from Express sessions is needed because deployments shut down the
application and drop existing Redis sessions. Other temporary and
authentication state remains in the Express session. This storage change does
not prevent another person from using an unlocked browser with the same session
cookie.

See [ADR-0001](../decisions/0001-session-scoped-application-state.md) for the
decision and its trade-offs.
