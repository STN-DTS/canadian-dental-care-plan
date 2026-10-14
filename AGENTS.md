# Repository Guidance for Coding Agents

## Scope and boundaries

- Keep each task focused on one coherent change. Include the code, tests,
  documentation, and configuration needed to complete it; leave unrelated
  fixes and upgrades for separate tasks.
- Work in the repository area named by the user. Inspect every relevant file
  needed to trace behavior and verify the result, not only attached files.
- `frontend/` contains the React Router, React, TypeScript, and Express
  application. Keep application-specific dependencies and checks there.
- `gitops/` contains Kubernetes manifests and Kustomize overlays.
  `infrastructure/` contains Terraform and Terragrunt configuration.
- Root configuration and `.github/` are shared concerns. Inspect them when
  installs, builds, CI, or editor tooling are part of the task.
- Cross repository areas only when the requested outcome requires it. Explain
  coupled changes, such as frontend configuration and its deployment settings;
  do not broaden a UI fix into unrelated infrastructure maintenance.

## Repository instructions

- Follow applicable files under `.github/instructions/`. Frontend Express
  naming rules apply only to the paths declared in their `applyTo` patterns.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution scope, validation,
  and PR expectations. Also follow the area-specific guidance for files under
  [frontend/](frontend/AGENTS.md), [gitops/](gitops/AGENTS.md), or
  [infrastructure/](infrastructure/AGENTS.md). Nested guidance supplements these
  shared rules; it does not apply to sibling areas.
- Follow the [GitHub Actions fork protection guidance](.github/copilot-instructions.md#github-actions-fork-protection)
  when modifying workflows. Preserve event filters and existing dependencies.
- Use code, manifests, and package scripts as the source of truth for current
  behavior and tool versions. Do not import another project's directory layout,
  release process, or commands without a requirement.

## Changes and data handling

- Read existing code before editing and reuse established patterns and helpers.
- Preserve existing behavior unless the task calls for a behavior change.
  Add regression tests for bug fixes and focused tests for new behavior.
- Do not commit secrets, applicant information, local environment files,
  Terraform state, generated output, or local telemetry data.
- Preserve user changes in a dirty worktree. Do not revert, stage, or commit
  unrelated changes.
- Do not apply Kubernetes or infrastructure changes merely to validate code.
  Record checks that require unavailable credentials or external access.

## Shared tooling and validation

- Install dependencies from the repository root. The workspace includes
  `@cdcp-rcsd/frontend`; `@cdcp-rcsd/workspace` owns shared tools and scripts.
- Preserve root pnpm policies and commit manifest changes with any required
  root lockfile updates. Keep application dependencies in the frontend package.
- Use the smallest check that proves the requested outcome. Run validation for
  affected areas, including frontend checks when shared tooling affects it.
- Format only changed files unless a formatting cleanup is requested:
  `pnpm exec oxfmt --check path/to/changed-file`. The root formatting check has
  an existing backlog outside the frontend; do not fix unrelated files.
- Build containers from the root with
  `podman build --file frontend/dockerfile --tag canadian-dental-care-plan .`.
  Preserve the isolated `pnpm deploy --prod` runtime, required public/build
  assets, non-root user, and OpenTelemetry startup imports.
- Report commands run, outcomes, and remaining verification gaps. A successful
  local build does not establish that CI or live deployment succeeds.

## Commits and pull requests

Follow [commit and PR title guidance](CONTRIBUTING.md#commit-messages-and-pr-titles).
Explain what changed, why, which areas it affects, and how it was tested.
Create commits or pull requests only when requested.
