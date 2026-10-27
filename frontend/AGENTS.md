# Frontend Agent Guidance

These rules supplement the [root guidance](../AGENTS.md) for files under
`frontend/`. Read [CONTRIBUTING.md](CONTRIBUTING.md) for frontend conventions.

- Inspect application code and relevant root tooling together when needed.
  Do not inspect or change unrelated GitOps or infrastructure implementations.
- Keep server-only services, sessions, integrations, and secrets in
  `app/.server/`; do not expose server environment values to the browser.
- Use React Router loaders for reads and actions for mutations. Follow
  existing route helpers, validation, and error-handling patterns.
- Preserve authentication, CSRF protection, session handling, accessibility,
  and English/French journeys. Update both route paths and translations when
  changing localized behavior.
- Follow the [path-scoped Express instructions](../.github/instructions/frontend-express.instructions.md)
  for Express server files, especially stable middleware names used by telemetry.
- Keep unit tests in `__tests__/` and browser tests in `e2e/`. Use existing
  mocks; do not call real government or partner services from unit tests.
- From the repository root, run focused unit tests with
  `pnpm --filter @cdcp-rcsd/frontend run test path/to/test.ts`.
  `pnpm run check` runs repository formatting, workspace type generation/checking,
  and Oxlint in order, continuing after failures and failing overall if any check fails.
- Run type generation before standalone type-aware Oxlint. Run
  `pnpm --filter @cdcp-rcsd/frontend run build` before Playwright tests; inspect `playwright.config.ts`
  before changing browser-test startup or environment settings.
- Use package scripts for server starts. They load the official OpenTelemetry
  ESM hook and preload the SDK configuration; do not bypass either.
- The package is `@cdcp-rcsd/frontend`. Its deployment `files` list must include
  runtime `build/` and `public/` assets. Preserve the Docker deploy selector
  when changing package names.
- Oxfmt and formatting scripts belong to the root package. The nested frontend
  `oxfmt.config.ts` imports root defaults and adds frontend rules. Frontend
  `check` runs only typechecking and linting; root `check` also checks formatting.
  Keep nested config discovery enabled for frontend files.
