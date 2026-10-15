# Contributing

Guidance for changes to the Canadian Dental Care Plan frontend.

Read the [root contributing guide](../CONTRIBUTING.md) for shared workspace
setup, dependency management, formatting, and pull request guidance.
The commands below run from `frontend/` unless stated otherwise.

## Before you start

Complete the workspace setup in the [root guide](../CONTRIBUTING.md#before-you-start),
then:

1. Copy `.env.example` to `.env` and keep local credentials out of source control.
2. Read the relevant documentation under `other/docs/` before changing authentication, routes, eligibility, document upload, or telemetry.

Start the application with:

```sh
pnpm run dev
```

Use `pnpm run dbg` when debugging server code. Use package scripts for all
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

Add or update focused tests with behavior changes. Keep unit tests in
`__tests__/` and end-to-end tests in `e2e/`.

For bug fixes, add a regression test that reproduces the failure and confirms
the corrected behavior.

Run a focused test while developing:

```sh
pnpm test path/to/test.ts
```

Use `pnpm run test:unit path/to/test.ts` to watch that test during development.

Run the normal pull request checks before submitting:

```sh
pnpm --dir .. run check
pnpm run test:unit:coverage
pnpm run build
```

Run `typecheck` before `lint` or `lint:fix` to generate the route types needed
by type-aware Oxlint. The frontend `pnpm run check` command handles those two
checks in order, without formatting. Formatting scripts live at the root;
use `pnpm --dir .. run format:check` or `pnpm --dir .. run format:write`
from `frontend/`.

Run browser tests against a fresh production build:

```sh
pnpm run build
pnpm run test:e2e
```

Install the Playwright browser when needed:

```sh
pnpm run test:e2e:install
```

## Localization

User-facing content must exist in both English and French. Keep translation
keys consistent between locale files. Use the existing i18next helpers and
components instead of embedding user-facing strings in route modules.

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
- Run formatting, typechecking, linting, focused tests, and `pnpm run build`.
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
