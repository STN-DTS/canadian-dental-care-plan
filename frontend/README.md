# Canadian Dental Care Plan

Frontend for the Government of Canada's Canadian Dental Care Plan (CDCP).
The application supports English and French journeys to:

- apply for or renew dental coverage
- manage applicant and family information
- upload documents and view letters
- check application and benefit status

## Stack

- React 19 and React Router 8 with server-side rendering
- Express 5 and Node.js ESM
- TypeScript 7 and Vite 8
- Tailwind CSS 4
- i18next and react-i18next
- Zod for validation
- Express sessions with memory or Redis storage
- OpenTelemetry and Winston for observability and logging
- Vitest, Testing Library, and Playwright for testing

## Local setup

### Requirements

- Node.js `>=26.0.0 <27.0.0`
- pnpm `>=12.0.0 <13.0.0`
- Podman for the optional local telemetry stack

Versions are enforced in `package.json`.

### Install

```sh
pnpm install
cp .env.example .env
```

PowerShell equivalent:

```powershell
Copy-Item .env.example .env
```

Review `.env` before starting the application. It contains local feature flags
and mock integration settings. Never commit `.env` or real credentials.

### Start development server

```sh
pnpm run dev
```

Open <http://localhost:3000>. The root route selects English or French;
application routes use `/en` and `/fr` prefixes.

Use the inspector when debugging server code:

```sh
pnpm run dbg
```

Use package scripts to start the server. They preload the OpenTelemetry ESM
modules before Express and other instrumented modules.

## Developer commands

Run before opening a pull request:

```sh
pnpm run lint
pnpm run test:unit:coverage
pnpm run build
```

Available commands:

- `pnpm run dev`: start development server with HMR
- `pnpm run dbg`: start development server with Node inspector
- `pnpm run build`: build client and production server
- `pnpm run preview`: build and run production-style server
- `pnpm start`: run existing production build
- `pnpm run typecheck`: generate route types and run TypeScript checks
- `pnpm run lint`: run Prettier, TypeScript, and Oxlint checks
- `pnpm run lint:fix`: apply formatting and Oxlint fixes
- `pnpm run lint:oxlint`: run Oxlint syntax and TypeScript Go-based type-aware checks
- `pnpm run test:unit`: run Vitest in watch mode
- `pnpm run test:unit:coverage`: run Vitest with coverage
- `pnpm run test:e2e`: run Playwright end-to-end tests
- `pnpm run test:e2e:smoke`: run Playwright smoke tests
- `pnpm run test:e2e:install`: install Playwright Chromium

Run end-to-end tests against a fresh production build:

```sh
pnpm run build
pnpm run test:e2e
```

## Linting

Oxlint replaces ESLint and `typescript-eslint`; `oxlint-tsgolint` provides the
type-aware rules using TypeScript Go. Prettier remains responsible for formatting,
and `tsc` remains responsible for project type checking. The configuration retains
the prior core, TypeScript, React, JSX accessibility, Unicorn, and Vitest intent
where Oxlint has an equivalent. `eslint-plugin-import-zod`,
`import-x/consistent-type-specifier-style`, and the remaining `@eslint-react`
specialized rules have no Oxlint equivalent and are not enforced. The scoped
`file-upload.tsx` accessibility exception is retained in `.oxlintrc.json`.

See [`other/docs/typescript-7-migration.md`](./other/docs/typescript-7-migration.md)
for TypeScript 7 breaking changes, defaults, and compatibility notes.

## Code organization

```text
app/
  components/       Shared UI components
  routes/           Public, protected, and error routes
  .server/          Services, integrations, sessions, and translations
  entry.client.tsx  Browser entry point
  entry.server.tsx  Server-rendering entry point
__tests__/          Vitest tests
e2e/                Playwright tests
other/docs/         Feature and development documentation
public/             Static assets
```

Routes use React Router loaders for reads and actions for mutations. Route
definitions keep English and French paths together. Translations live under
`app/.server/locales`.

Keep server-only code under `app/.server`. Validate request data at route
boundaries with Zod. Follow existing component, localization, accessibility,
and error-handling patterns before adding new abstractions.

## Mock integrations

Local development and end-to-end tests use mock integrations configured through
`.env`. `ENABLED_FEATURES` controls optional journeys such as status, letters,
hCaptcha, and document upload. `ENABLED_MOCKS` controls mocked external
services.

Check [authentication.md](other/docs/authentication.md) before changing local
authentication. Keep mock values local and use environment variables for all
service credentials and endpoints.

## Local telemetry

Optional Podman Compose stack sends frontend logs, metrics, and traces through
Grafana Alloy to Loki, Prometheus, and Tempo. Grafana provides the UI.

```sh
podman compose -f compose.otel-local.yaml up -d
```

See [observability.md](other/docs/observability.md) for `.env` configuration,
volume management, backups, and troubleshooting details.

## Production output

```sh
pnpm run build
pnpm start
```

Build output:

```text
build/
  client/    # Browser assets
  server/    # Bundled Express server
```

Do not launch the server entry point directly. The `dev`, `preview`, and `start`
scripts preload the required OpenTelemetry modules.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [React Router documentation](https://reactrouter.com/)
- [Application routes reference](other/docs/application-routes-reference.md)
- [Authentication](other/docs/authentication.md)
- [Member eligibility](other/docs/member-eligibility-feature.md)
- [Document upload](other/docs/document-upload-feature.md)
- [Local observability](other/docs/observability.md)
- [Express conventions](other/docs/express.md)
