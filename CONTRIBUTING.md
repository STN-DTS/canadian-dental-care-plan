# Contributing

Guidance for changes to the Canadian Dental Care Plan monorepo.

## Repository layout

- `frontend/`: React Router, React, TypeScript, and Express application.
- `gitops/`: Kubernetes manifests and Kustomize overlays.
- `infrastructure/`: Terraform and Terragrunt configuration.
- `.github/`: CI workflows, repository automation, and contribution instructions.
- Repository root: shared pnpm workspace, dependency lockfile, and formatting tools.

See the [README](README.md) for setup and available root commands.

## Before you start

1. Open the repository root in VS Code so all project areas and repository-level files are visible.
2. Install Node.js `>=26.0.0 <27.0.0` and the pnpm version pinned in the root `package.json`.
3. Run `pnpm install` from the repository root.
4. Read the documentation for the area you are changing:
   - [Frontend](frontend/CONTRIBUTING.md)
   - [GitOps](gitops/README.md)
   - [Infrastructure](infrastructure/README.md)
   - [GitHub workflows](.github/workflows/README.md)

Node.js and pnpm are needed for frontend and shared Node tooling changes.
For GitOps or infrastructure-only work, use the prerequisites in that area's
README; a frontend dependency install is not required.

For frontend development, copy `frontend/.env.example` to `frontend/.env` and
keep local credentials out of source control. Start the application from the
root with `pnpm run dev`; use `pnpm run dbg` for server debugging.

## Scope and boundaries

Keep each pull request focused on one coherent change. Include the code,
tests, documentation, and configuration needed to complete that change, but
submit unrelated fixes or dependency upgrades separately.

Cross frontend, GitOps, and infrastructure boundaries only when the same change
requires it. For example, adding application configuration may require a
frontend change and the corresponding Kubernetes environment settings in one
PR. A UI fix, an unrelated Terraform change, and a toolchain upgrade should be
separate PRs.

- Keep application code and application-specific dependencies in `frontend/`.
- Keep Kubernetes manifests and Kustomize overlays in `gitops/`.
- Keep Terraform and Terragrunt configuration in `infrastructure/`.
- Keep shared Node tooling, pnpm policies, and the lockfile at the repository root.
- Apply frontend naming and localization rules only to frontend code.
- Reuse existing patterns and helpers, and avoid unrelated changes.
- Update documentation and tests directly affected by a change.

Do not expose server credentials or environment variables to browser code.
Never commit secrets, local environment files, Terraform state, generated
build output, or local telemetry data.

## Dependencies and formatting

Run dependency installs from the repository root. The workspace contains the
root tooling package and the frontend application; GitOps and infrastructure
do not need Node manifests.

Add shared tools at the root:

```sh
pnpm add --workspace-root --save-dev <package>
```

Add application dependencies to the frontend:

```sh
pnpm --filter @cdcp-rcsd/frontend add <package>
```

Commit manifest changes with the updated root lockfile. Preserve the existing
pnpm engine, build-script, release-age, and dependency trust policies.

From the repository root, use `pnpm --filter @cdcp-rcsd/frontend run <script>`
to select the frontend workspace package. Root shortcuts such as
`pnpm run build` already forward to that package. The workspace sets
`failIfNoMatch: true`, so misspelled or missing package selectors fail.

Use `--dir` when intentionally selecting a working directory instead of a
workspace package. Frontend formatting scripts retain `--dir ..` to invoke
the root formatter.

Oxfmt handles supported repository file types:

```sh
pnpm run format:check
pnpm run format:fix
```

The root config defines shared defaults. The nested frontend config imports
them and adds application-specific rules. Oxfmt uses the nearest config for
each file; it does not automatically merge parent configs. Keep nested config
discovery enabled so root checks honor frontend rules.

Use targeted formatting during development to avoid unrelated changes:

```sh
pnpm exec oxfmt path/to/changed-file
```

The repository-wide check currently includes a pre-existing formatting backlog
outside the frontend. Do not reformat unrelated files as part of a feature or
tooling change. Check changed files explicitly until that backlog is resolved.

Use native formatting tools for unsupported formats, such as `terraform fmt`
for Terraform. Frontend-only formatting is available through
`pnpm --filter @cdcp-rcsd/frontend run format:check`.

## Validation

Run the smallest checks that cover your change, then the relevant pull request
checks before submitting. Run checks for the areas you changed rather than
every toolchain in the repository. Shared dependency, workspace, or container
changes also require frontend validation.

### Frontend

Run these commands from the repository root. The root `lint` command includes
repository-wide formatting, which currently has a backlog outside the frontend.
Check changed files and run frontend validation separately:

```sh
pnpm exec oxfmt --check path/to/changed-file
pnpm --filter @cdcp-rcsd/frontend run lint
pnpm run test:unit:coverage
pnpm run build
```

Once the formatting backlog is resolved, `pnpm run lint` can replace the
separate formatting and frontend lint commands above.

Run focused unit tests while developing:

```sh
pnpm test path/to/test.ts
```

Build before running browser tests:

```sh
pnpm run build
pnpm run test:e2e
```

Use mocks for local tests. Preserve bilingual behavior, accessibility,
authentication, CSRF protection, and session handling. See the
[frontend contributing guide](frontend/CONTRIBUTING.md) for detailed rules.

### GitOps and infrastructure

Render each affected Kustomize overlay from the repository root, for example:

```sh
kubectl kustomize gitops/nonprod/overlays/dev
```

For production changes, render `gitops/prod` instead. Changes to a shared base
require checking the overlays that consume it. See the [GitOps guide](gitops/README.md)
for validation tooling and environment boundaries.

Validate affected Terraform/Terragrunt configuration with the tools and
procedures in the [infrastructure guide](infrastructure/README.md). Plans may
require authorized Azure access; record validation you could not perform.
Do not apply deployments or infrastructure changes merely to validate a PR.

### CI and containers

Preserve event filters, job dependencies, and the non-fork prerequisite gate
when changing GitHub Actions workflows. Root dependency and build configuration
changes must trigger the frontend jobs that consume them.

Build frontend containers from the repository root:

```sh
podman build --file frontend/dockerfile --tag canadian-dental-care-plan .
```

## Pull request expectations

Use the [pull request template](.github/pull-request-template.md) and provide:

- **What and why:** describe the change and the problem it solves.
- **Affected areas:** identify frontend, GitOps, infrastructure, CI, or shared tooling.
- **Context:** link the relevant issue or Azure Boards work item with `AB#<id>`.
- **Validation:** list the commands run, their results, and any checks not run with a reason.
- **Review instructions:** explain setup or steps needed to verify the change.
- **UI evidence:** include screenshots when useful, without personal information or credentials.

Add regression tests for bug fixes and tests for new behavior. Root tooling or
deployment changes need checks of the install, build, or runtime paths they
affect, not unrelated application tests.

Review the applicable CI results before merging. See the
[workflow guide](.github/workflows/README.md) for triggers and change detection;
local validation does not prove that a live deployment succeeds.

### Commit messages and PR titles

Prefer the Conventional Commit style already used in repository history:

```text
<type>[(<scope>)]: <short description>
```

Examples:

```text
fix(frontend): preserve language selection after sign-in
docs: clarify local setup
chore(deps): update frontend dependencies
ci: validate root workspace changes
```

Choose a type that describes the effect: `feat` for new capabilities, `fix` for
bug fixes, `perf` for performance changes, `refactor` for behavior-preserving
restructuring, `docs` for documentation, `test` for tests, `build` for tooling,
`ci` for automation, and `chore` for maintenance. Use `style` for formatting,
not user-interface styling.

Scopes such as `frontend`, `gitops`, `infrastructure`, `deps`, or `ci` are
optional. Explain breaking changes and migration steps in the PR description.
These are recommended conventions, not commitlint-enforced rules.

### Checklist

- Explain the technical and user-visible changes.
- Link the relevant work item or issue.
- Keep changes scoped to the request.
- Add or update tests for behavior changes.
- Run the relevant formatting, lint, test, and build checks.
- Check English and French flows and accessibility for frontend UI changes.
- Update affected documentation.
- Commit dependency manifests and the root lockfile together.
- Confirm that no secrets, generated output, or local data are included.

## Coding agents

Follow [AGENTS.md](AGENTS.md) and the nested guidance for the area being changed.
Keep agent-generated changes subject to the same review and validation as
human-authored changes. Report checks performed and any verification gaps;
do not imply that local validation proves a live deployment succeeded.
