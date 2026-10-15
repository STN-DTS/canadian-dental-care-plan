# Canadian Dental Care Plan

Monorepo for the Canadian Dental Care Plan frontend, Kubernetes deployments,
and cloud infrastructure.

The program is known as the Canadian Dental Care Plan (CDCP) in English and
the Régime canadien de soins dentaires (RCSD) in French. Official public websites:

- [Canadian Dental Care Plan (English)](https://www.canada.ca/en/services/benefits/dental/dental-care-plan.html)
- [Régime canadien de soins dentaires (French)](https://www.canada.ca/fr/services/prestations/dentaire/regime-soins-dentaires.html)

## Repository structure

| Directory                          | Purpose                                                           |
| ---------------------------------- | ----------------------------------------------------------------- |
| [frontend/](frontend/)             | React Router, React, TypeScript, and Express application          |
| [gitops/](gitops/)                 | Kubernetes manifests and Kustomize overlays                       |
| [infrastructure/](infrastructure/) | Terraform and Terragrunt configuration                            |
| [.github/](.github/)               | GitHub Actions, dependency updates, and contribution instructions |

The pnpm workspace contains the root tooling package and one application
package, `frontend/`. GitOps and infrastructure use their native tools and
do not need Node package manifests.

Package names use the bilingual `@cdcp-rcsd` scope:

- `@cdcp-rcsd/workspace`: private root package for shared tooling and commands.
- `@cdcp-rcsd/frontend`: frontend application package.

## Local setup

Requirements:

- Node.js `>=26.0.0 <27.0.0`
- pnpm `>=12.0.0 <13.0.0`; the exact version is pinned in `package.json`
- Corepack to select the pinned pnpm version

Open the repository root in VS Code with **File > Open Folder**. Shared editor
settings, extension recommendations, and frontend debug launches live in
[.vscode/](.vscode/).

Run from the repository root:

```sh
npm install --global corepack@latest
corepack enable pnpm
pnpm install
cp frontend/.env.example frontend/.env
pnpm --filter @cdcp-rcsd/frontend run dev
```

Never commit local environment files or credentials. See the
[frontend setup guide](frontend/README.md) for environment configuration,
mock integrations, and local telemetry.

## Root commands

| Command                     | Purpose                                                |
| --------------------------- | ------------------------------------------------------ |
| `pnpm run check`            | Check repository formatting, workspace types, and lint |
| `pnpm run check:workspaces` | Run each workspace's own validation pipeline           |
| `pnpm run format:check`     | Check supported repository files with Oxfmt            |
| `pnpm run format:write`     | Format supported repository files with Oxfmt           |

`check` runs repository formatting, then each workspace's `check` script.
The frontend check runs typechecking before linting. Checks continue
after failures and exit nonzero if any phase or workspace fails. They do not
apply formatting or lint fixes; frontend typechecking generates route types.

Run frontend commands from `frontend/`, or with
`pnpm --filter @cdcp-rcsd/frontend run <script>` from the root.
Formatting scripts live only at the root and include frontend files using
the nested frontend configuration.

The workspace sets `failIfNoMatch: true`, so a filter that matches no package
fails rather than silently skipping the command.

During development, check changed files with
`pnpm exec oxfmt --check path/to/changed-file`. For frontend-only validation,
run `pnpm --filter @cdcp-rcsd/frontend run check` for typechecking and linting;
it does not check formatting.
Apply fixes explicitly with `pnpm --filter @cdcp-rcsd/frontend run lint:fix`
after type generation, and `pnpm run format:write` for formatting.

Build before running end-to-end tests:

```sh
pnpm --filter @cdcp-rcsd/frontend run build
pnpm --filter @cdcp-rcsd/frontend run test:e2e
```

## Tooling boundaries

The root owns the pnpm workspace settings, dependency catalog, shared lockfile,
Oxfmt, and the task runner for combined checks. Package manifests reference
versions in `pnpm-workspace.yaml` using `catalog:`. Run dependency installs from the root; CI uses
`pnpm install --frozen-lockfile`.

[oxfmt.config.ts](oxfmt.config.ts) defines shared formatting defaults and ignores.
[frontend/oxfmt.config.ts](frontend/oxfmt.config.ts) imports those defaults and
adds Tailwind class sorting and locale quote overrides.
Oxfmt discovers the nearest config for each file; root commands also use the
nested frontend config. Generated output, dependency directories, and the pnpm
lockfile are excluded.

Frontend runtime dependencies, TypeScript, Oxlint, Vitest, and Playwright stay
in [frontend/package.json](frontend/package.json). Use native tools such as
`terraform fmt` for formats Oxfmt does not support.

## Container build

Use the repository root as the build context:

```sh
podman build --file frontend/dockerfile --tag canadian-dental-care-plan .
```

[.dockerignore](.dockerignore) limits the context to workspace manifests and
frontend build inputs. GitOps, infrastructure, local environment files, and
generated output are not sent to the builder.

After building, the Dockerfile uses `pnpm deploy --prod` to create a portable
frontend package with its own production dependencies. The frontend manifest's
`files` field includes `build/` and `public/`; source code and development tools
are not included in the final image.

## Documentation

- [Contributing](CONTRIBUTING.md)
- [Frontend](frontend/README.md)
- [Frontend contributing guide](frontend/CONTRIBUTING.md)
- [GitOps](gitops/README.md)
- [Infrastructure](infrastructure/README.md)
- [GitHub workflows](.github/workflows/README.md)
