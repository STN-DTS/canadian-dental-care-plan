# Contributing

Guidance for changes to the Canadian Dental Care Plan frontend.

Read the [root contributing guide](../CONTRIBUTING.md) for shared workspace
setup, dependency management, formatting, and pull request guidance.
The commands below run from the repository root.

## Before you start

Complete the workspace setup in the [root guide](../CONTRIBUTING.md#before-you-start),
then:

1. Copy `frontend/.env.example` to `frontend/.env` and keep local credentials out of source control.
2. Read the relevant documentation under `frontend/other/docs/` before changing authentication, routes, eligibility, document upload, or telemetry.

Start the application with:

```sh
pnpm --filter @cdcp-rcsd/frontend run dev
```

Use `pnpm --filter @cdcp-rcsd/frontend run dbg` when debugging server code. Use package scripts for all
server starts because they preload the OpenTelemetry ESM modules.

## Code boundaries

- Keep server-only services, integrations, sessions, and secrets under `app/.server`.
- Keep route modules under `app/routes`.
- Use React Router loaders for reads and actions for mutations.
- Define English and French route paths together in the route configuration.
- Add or update English and French translations under `app/.server/locales`.
- Validate request data at route boundaries with Zod.
- Preserve CSRF protection, session handling, accessibility, and bilingual behavior.
- Follow existing components and utilities before adding new abstractions.

Do not expose server environment variables or service credentials to browser
code. Use the existing client environment configuration for values that must be
available in the browser.

## Naming and API methods

Use clear, domain-specific names. Keep method names consistent across services
and repositories:

- `get`: retrieve an expected result; throw or handle missing data according to the use case
- `find`: search when no result is valid; return `null`, `undefined`, or an empty collection as documented
- `list`: retrieve a collection
- `create`: create and persist an entity
- `update`: update an existing entity
- `delete`: remove an entity

Prefer precise TypeScript return types, readonly data where practical, and
explicit error behavior. Keep asynchronous service and repository operations
consistent with surrounding code. Add domain-specific methods when standard
CRUD names do not express intent clearly.

## Tests

Add or update focused tests with behavior changes. Keep Vitest unit tests in
`__tests__/` and Playwright end-to-end tests in `e2e/`.

The frontend `node` and `jsdom` projects also participate in the root
`pnpm test` command. Use Playwright for end-to-end tests.

For bug fixes, add a regression test that reproduces the failure and confirms
the corrected behavior.

Run a focused test while developing:

```sh
pnpm test frontend/__tests__/path/to/test.ts
```

Use `pnpm run test:unit frontend/__tests__/path/to/test.ts` to watch
that test during development. Unit-test scripts live at the repository root.
Use `pnpm test --project frontend` for frontend tests only.

Run the normal pull request checks before submitting:

```sh
pnpm run check
pnpm run test:unit:coverage
pnpm --filter @cdcp-rcsd/frontend run build
```

Run `typecheck` before `lint` or `lint:fix` to generate the route types needed
by type-aware Oxlint. The `pnpm --filter @cdcp-rcsd/frontend run check` command handles those two
checks in order, without formatting. Formatting scripts live at the root;
use `pnpm run format:check` or `pnpm run format:write`.

Run browser tests against a fresh production build:

```sh
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend run test:e2e
```

Install the Playwright browser when needed:

```sh
pnpm --filter @cdcp-rcsd/frontend run test:e2e:install
```

## Dates and clocks

Initialize `temporal-polyfill/global` only in the client entrypoint, not in
consumers. Node.js 26 provides native Temporal for SSR, Express, OpenTelemetry,
and Playwright. Shared Vitest setup also supports explicit fallback testing.
Use the global `Temporal` namespace so Vitest can replace its clock with
`vi.useFakeTimers({ now: Temporal.Instant.from('2026-07-01T00:00:00Z') })`.
The shared test setup restores real timers after each test. Named Temporal
imports retain their original clock when Vitest replaces the global namespace.

Use `Temporal.PlainDate` for birthdates and calendar calculations, and
`Temporal.Instant` for timestamps. Business-date calculations use UTC.
Apply explicit display timezones only to instants, never to birthdates.
Keep API, session, and loader values as strings or numbers. Serialize timestamps
with `instant.toString()` using Temporal's default precision.
Use `overflow: 'reject'` when constructing calendar dates from form fields.
The date validators return `{ valid: true, date }` or `{ valid: false, error }`.
Check `valid` and reuse `date` instead of validating and parsing separately.

Run `TEMPORAL_EXPECT_POLYFILL=true pnpm test` to force the JavaScript
implementation in test workers. The runtime test verifies that native Temporal
is not being used in this mode.

## Localization

User-facing content must exist in both English and French. Keep translation
keys consistent between locale files. Use the existing i18next helpers and
components instead of embedding user-facing strings in route modules.

Check translation coverage from the repository root with
`pnpm --filter @cdcp-rcsd/frontend exec i18next-cli status`.
The extractor configuration registers the server-side `getFixedT` helper with
its namespace in the second argument. Pass the bound `t` function to `Trans`
when using a namespace constant so extraction can resolve the namespace.
Define context variants used by the application explicitly in both locales.

When adding a localized route:

- add both language paths in the route definition
- add both locale translations
- preload the required namespace through the existing route handle pattern
- verify language switching and localized document metadata

## External services and mocks

Local development and end-to-end tests use values from `.env`.
`ENABLED_FEATURES` controls optional journeys. `ENABLED_MOCKS` controls mocked
external services.

Use mocks for local tests. Do not call real government or partner services from
unit tests. Keep API endpoints, subscription keys, JWT keys, and other secrets
in environment configuration.

## Pull request checklist

Follow the [root PR expectations and checklist](../CONTRIBUTING.md#pull-request-expectations).
For frontend changes, also:

- Check English and French flows.
- Check keyboard access, labels, errors, and focus behavior for UI changes.
- Run formatting, typechecking, linting, focused tests, and `pnpm --filter @cdcp-rcsd/frontend run build`.
- Build before running browser tests, and state which journeys were tested.
- Keep screenshots and reproduction steps free of applicant information.

## Related documentation

- [README](README.md)
- [Application routes reference](other/docs/application-routes-reference.md)
- [Authentication](other/docs/Authentication.md)
- [Member eligibility](other/docs/member-eligibility-feature.md)
- [Document upload](other/docs/document-upload-feature.md)
- [Local observability](other/docs/observability.md)
- [Express conventions](other/docs/express.md)
