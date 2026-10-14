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
  `pnpm test path/to/test.ts`. `pnpm --filter @cdcp-rcsd/frontend run lint` runs frontend
  formatting, type generation/checking, and Oxlint in the required order.
- Run type generation before standalone type-aware Oxlint. Run
  `pnpm run build` before Playwright tests; inspect `playwright.config.ts`
  before changing browser-test startup or environment settings.
- Use package scripts for server starts. They preload the OpenTelemetry ESM
  registration and instrumentation modules; do not bypass these imports.
- The package is `@cdcp-rcsd/frontend`. Its deployment `files` list must include
  runtime `build/` and `public/` assets. Preserve the Docker deploy selector
  when changing package names.
- Oxfmt belongs to the root package. Frontend formatting scripts use the
  nested `oxfmt.config.ts`, which imports root defaults and adds frontend rules.
  Do not force the root config or disable nested discovery for frontend checks.
