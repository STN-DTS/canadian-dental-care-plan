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
- Corepack and pnpm `>=12.0.0 <13.0.0`
- Podman for the optional local telemetry stack

Versions are enforced in `package.json`.

### Install

Run all commands in this guide from the repository root.

```sh
npm install --global corepack@latest
corepack enable pnpm
pnpm install
cp frontend/.env.example frontend/.env
```

Dependencies use the root workspace and lockfile. Corepack selects the version
pinned in the root `package.json`.

To copy the environment file in PowerShell:

```powershell
Copy-Item frontend/.env.example frontend/.env
```

Review `frontend/.env` before starting the application. It contains local feature flags
and mock integration settings. Never commit `frontend/.env` or real credentials.

### Start development server

```sh
pnpm --filter @cdcp-rcsd/frontend run dev
```

Open <http://localhost:3000>. The root route selects English or French;
application routes use `/en` and `/fr` prefixes.

Use the inspector when debugging server code:

```sh
pnpm --filter @cdcp-rcsd/frontend run dbg
```

Use package scripts to start the server. They preload the OpenTelemetry ESM
modules before Express and other instrumented modules.

## Developer commands

Run before opening a pull request:

```sh
pnpm run check
pnpm run test:unit:coverage
pnpm --filter @cdcp-rcsd/frontend run build
```

The root check includes repository formatting and workspace validation.
Use `pnpm --filter @cdcp-rcsd/frontend run check` for only frontend typechecking and linting.

Available commands:

- `pnpm --filter @cdcp-rcsd/frontend run dev`: start development server with HMR
- `pnpm --filter @cdcp-rcsd/frontend run dbg`: start development server with Node inspector
- `pnpm --filter @cdcp-rcsd/frontend run build`: build client and production server
- `pnpm --filter @cdcp-rcsd/frontend run preview`: build and run production-style server
- `pnpm --filter @cdcp-rcsd/frontend run start`: run existing production build
- `pnpm --filter @cdcp-rcsd/frontend run check`: generate route types, check TypeScript, and run Oxlint
- `pnpm --filter @cdcp-rcsd/frontend run typecheck`: generate route types and run TypeScript checks
- `pnpm --filter @cdcp-rcsd/frontend run lint`: run Oxlint syntax and type-aware checks
- `pnpm --filter @cdcp-rcsd/frontend run lint:fix`: apply automatic Oxlint fixes
- `pnpm test`: run all root and frontend unit tests once
- `pnpm test --project frontend`: run frontend unit tests only
- `pnpm run test:unit`: run Vitest in watch mode
- `pnpm run test:unit:coverage`: run Vitest with coverage
- `pnpm --filter @cdcp-rcsd/frontend run test:e2e`: run Playwright end-to-end tests
- `pnpm --filter @cdcp-rcsd/frontend run test:e2e:smoke`: run Playwright smoke tests
- `pnpm --filter @cdcp-rcsd/frontend run test:e2e:install`: install Playwright Chromium

Run end-to-end tests against a fresh production build:

```sh
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend run test:e2e
```

## Linting

Oxlint provides syntax and type-aware linting, Oxfmt handles formatting, and
TypeScript performs project type checking. Frontend configuration lives in
`frontend/oxlint.config.ts` and `frontend/tsconfig.json`. [oxfmt.config.ts](oxfmt.config.ts) imports
the [root formatting defaults](../oxfmt.config.ts) and adds frontend-specific
rules. Formatting scripts live at the root and check the whole repository,
including frontend files using this nested config. Run
`pnpm run format:check` or `pnpm run format:write`.

Run `pnpm --filter @cdcp-rcsd/frontend run typecheck` before
`pnpm --filter @cdcp-rcsd/frontend run lint` or
`pnpm --filter @cdcp-rcsd/frontend run lint:fix`: typecheck generates the
React Router route types that Oxlint's type-aware rules depend on. CI jobs that
run these checks separately must preserve this order. The root `pnpm run check`
command runs formatting, typecheck, and Oxlint in the correct sequence and
continues after failures while reporting an overall failure status. The frontend
`pnpm --filter @cdcp-rcsd/frontend run check` runs only typecheck and Oxlint in that order.

## Code organization

Paths below are relative to `frontend/`:

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
`frontend/.env`. `ENABLED_FEATURES` controls optional journeys such as status, letters,
hCaptcha, and document upload. `ENABLED_MOCKS` controls mocked external
services.

Check [Authentication.md](other/docs/Authentication.md) before changing local
authentication. Keep mock values local and use environment variables for all
service credentials and endpoints.

## Local telemetry

Optional Podman Compose stack sends frontend logs, metrics, and traces through
Grafana Alloy to Loki, Prometheus, and Tempo. Grafana provides the UI.

```sh
podman compose -f frontend/compose.otel-local.yaml up -d
```

See [observability.md](other/docs/observability.md) for `.env` configuration,
volume management, backups, and troubleshooting details.

## Production output

```sh
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend run start
```

Build output under `frontend/`:

```text
build/
  client/    # Browser assets
  server/    # Bundled Express server
```

Do not launch the server entry point directly. The `dev`, `preview`, and `start`
scripts preload the required OpenTelemetry modules.

Container builds run from the repository root using `frontend/dockerfile`.
After the build, the Dockerfile runs
`pnpm --filter @cdcp-rcsd/frontend --prod deploy /home/node/deploy` to package
`build/`, `public/`, the package manifest, and isolated production dependencies.
The final image does not depend on the repository's workspace directory layout.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [React Router documentation](https://reactrouter.com/)
- [Application routes reference](other/docs/application-routes-reference.md)
- [React Router middleware](other/docs/middleware.md)
- [Authentication](other/docs/Authentication.md)
- [Member eligibility](other/docs/member-eligibility-feature.md)
- [Document upload](other/docs/document-upload-feature.md)
- [Local observability](other/docs/observability.md)
- [Express conventions](other/docs/express.md)
- [TypeScript 7 migration notes](other/docs/typescript-7-migration.md)
