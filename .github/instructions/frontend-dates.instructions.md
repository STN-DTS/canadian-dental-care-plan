---
description: 'Use when writing frontend TypeScript date/time handling, Temporal validation, calendar calculations, timestamp serialization, or fake-clock tests.'
applyTo: 'frontend/**/*.ts,frontend/**/*.tsx'
---

# Frontend dates and clocks

Follow the [dates and clocks guide](../../frontend/CONTRIBUTING.md#dates-and-clocks).

- Use Temporal instead of date-fns or JavaScript Date for application-owned date/time logic. Keep third-party Date conversions at integration boundaries.
- Import `temporal-polyfill/global` only in the client entrypoint. Server code uses native Node.js 26 Temporal. Use the global namespace rather than named imports so Vitest fake timers control the clock.
- Use `Temporal.PlainDate` for birthdates and calendar dates, and `Temporal.Instant` for timestamps. Business-date calculations use UTC. Apply explicit display timezones to instants, not birthdates.
- Pass `{ overflow: 'reject' }` when constructing calendar dates from form fields so impossible dates fail instead of silently clamping.
- Reuse the date utilities. Check the validators' `valid` discriminator and reuse their parsed `date` rather than validating and parsing twice.
- Keep API, session, and loader values as strings or numbers. Use `instant.toString()` with default precision unless a documented external contract requires otherwise.
- Freeze clocks with `vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z') })`. Use explicit instants instead of host-local dates. Shared test cleanup restores real timers.
- For changes affecting browser fallback behavior, run the Temporal Playwright tests, which disable native Temporal before client startup.
