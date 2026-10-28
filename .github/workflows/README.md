# GitHub workflows

CI validation, image publication, GitOps deployment, and reporting for the Canadian Dental Care Plan.

## Workflow summary

| Workflow                                                                             | Triggers                                                                                                    | Purpose                                                                                                                                                  |
| ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [pr-checks.yaml](pr-checks.yaml)                                                     | PRs targeting `main` or `release/**`; manual; reusable                                                      | Check formatting, root types, root lint, and root unit tests for every PR. Run frontend tests and build an unpublished image when relevant files change. |
| [build-publish-main-nonprod.yaml](build-publish-main-nonprod.yaml)                   | Pushes to `main` or `release/v*`; manual; reusable                                                          | Test, scan, publish, and sign nonprod images. Main promotes `latest` and restarts dev/int1 deployments; release branches promote RC aliases.             |
| [gitops-main-nonprod.yaml](gitops-main-nonprod.yaml)                                 | GitOps pushes to `main`; manual; reusable, all restricted to `main`                                         | Monitor `gitops/nonprod` on `main` and apply selected Kustomizations to the nonprod AKS cluster.                                                         |
| [gitops-main-prod.yaml](gitops-main-prod.yaml)                                       | GitOps pushes to `main`; manual; reusable, all restricted to `main`                                         | Apply the production root Kustomization to the prod AKS cluster.                                                                                         |
| [build-publish-tag-nonprod.yaml](build-publish-tag-nonprod.yaml)                     | Pushes of `v*` tags; manual                                                                                 | Test, scan, publish, and sign release-tagged images in nonprod ACR.                                                                                      |
| [build-publish-tag-prod.yaml](build-publish-tag-prod.yaml)                           | Pushes of `v*` tags; manual                                                                                 | Test, scan, publish, and sign release-tagged images in PROD ACR.                                                                                         |
| [nightly-e2e.yaml](nightly-e2e.yaml)                                                 | Daily at 00:00 UTC; manual                                                                                  | Build the frontend, run Chromium end-to-end tests, and retain Playwright reports.                                                                        |
| [renovate.yaml](renovate.yaml)                                                       | Every 15 minutes, weekdays 08:00-16:59 Toronto; Mondays 00:17-03:17 UTC hourly; manual, default branch only | Maintain dependency PRs using a repository-scoped App token; write runs require explicit activation.                                                     |
| [upload-prod-test-results-sharepoint.yaml](upload-prod-test-results-sharepoint.yaml) | Successful PROD tag workflow completion                                                                     | Upload the exact source run's test reports to SharePoint as `<release-tag>.zip`.                                                                         |

Tag publishing workflows validate `vX.Y.Z` with an optional suffix. Manual runs
must select a release-tag ref; branch refs are rejected. Pushing a matching tag
triggers both nonprod and PROD publication.

Frontend jobs in PR and nonprod branch workflows use change detection. Publishing
from the nonprod branch workflow is restricted to `main` and `release/v*` refs.

PR checks run repository-wide formatting, root TypeScript checking, root
linting, and the Vitest `root` project in the `check-workspace` job after
the non-fork `check-repository` gate.
PR jobs use their job IDs as check names, preserving the required
`build-frontend` and `test-frontend` checks. The workspace job runs for all changes,
including documentation, GitOps, and infrastructure. Frontend testing runs
separately. Publishing workflows do not repeat root typechecking or linting.
The nonprod branch workflow checks frontend formatting in `test-frontend`
and uses the push path filters below.

In both tag publishing workflows, `test-frontend` depends on `check-repository`,
and `build-frontend` depends on both jobs. The test job validates the release tag
before checkout or dependency installation. It then checks repository formatting
and frontend types and lint, runs unit tests, builds the application, and runs
end-to-end tests. These steps share one setup and dependency installation.
The build job reads the validated version from
`needs.test-frontend.outputs.version`. Formatting failures stop subsequent tests.
The test job must pass before image publishing can run.

Workflows that require pnpm use the pinned `pnpm/setup` action, which reads
Node.js and pnpm versions from the root `devEngines.runtime` and `packageManager`
fields, respectively. PR checks, publishing tests, and nightly E2E jobs install
dependencies with the required lockfile and cache the pnpm store by lockfile.
The SharePoint report-upload job needs only Node.js and uses `actions/setup-node`
with `node-version-file: package.json`, without installing pnpm or workspace dependencies.
Workflows check out the repository before setting up Node.js; `workflow_run`
consumers use the trusted default branch.

Node jobs install dependencies from the repository root using the shared pnpm
workspace and lockfile. Frontend unit tests use the root
`pnpm run test:unit:coverage --project frontend` command for the nested frontend
Vitest projects; reports remain in `frontend/coverage/`.
Frontend application commands also run from the root and
select the package with `pnpm --filter @cdcp-rcsd/frontend run <script>`;
Playwright installation uses `pnpm --filter @cdcp-rcsd/frontend exec playwright`.
Container builds use the repository root as their context; the root
`.dockerignore` includes only workspace manifests and frontend build inputs.
Changes to root package, lockfile, workspace, formatter, shared linter, Vitest, or Docker
context configuration also enable frontend validation and builds. The root
`tsconfig.json` configures only root tooling and does not trigger frontend jobs.
The PR root check validates it on every run. Root lint steps use `pnpm run lint`,
which selects the root config and excludes frontend files. Frontend typechecking
generates React Router types before frontend linting runs. Nightly E2E, GitOps,
dependency automation, and report-upload workflows do not repeat these checks.

### Nonprod branch guards

[build-publish-main-nonprod.yaml](build-publish-main-nonprod.yaml) starts
automatically only for pushes to `main` or `release/v*` that change at least one
of these repository-relative paths:

```yaml
paths:
  - .github/actions/aqua-scan/**
  - .github/actions/azure-acr-login/**
  - .github/actions/generate-build-vars/**
  - .github/actions/push-container-image/**
  - .github/actions/sign-container-image/**
  - .github/workflows/build-publish-main-nonprod.yaml
  - frontend/**
  - package.json
  - pnpm-lock.yaml
  - pnpm-workspace.yaml
  - oxfmt.config.ts
  - oxlint.config.ts
  - vitest.config.ts
  - .dockerignore
```

The `detect-changes` job checks the same paths before enabling frontend testing
and publishing. Changes limited to GitOps, infrastructure, documentation outside
these paths, or unrelated local actions do not trigger this workflow. Keep both
path lists aligned when adding or removing a local action used by the workflow.

Manual dispatches and reusable calls bypass path-based change detection. A push
that creates a `release/v*` branch also enables frontend jobs once the workflow
has been triggered; it does not bypass the push path filter. Publishing still
requires a `main` or `release/v*` ref and successful version resolution and tests.
Version resolution runs as the first step of the image-build job, after frontend
tests and formatting succeed, before checkout or authentication.
All jobs remain dependent on the non-fork `check-repository` gate.

### Nonprod GitOps deployment

**GitOps operator (nonprod)**, defined in
[gitops-main-nonprod.yaml](gitops-main-nonprod.yaml), responds to pushes on `main`
that change `gitops/nonprod/**` or the workflow itself. It applies selected
Kustomizations to the nonprod AKS cluster using `kubectl apply --kustomize`.
It runs in response to workflow events, not as a continuous cluster reconciler.

All deployment runs must use `refs/heads/main`, including manual and reusable
runs. The prerequisite gate rejects other branches and tags. Fork repositories
skip the gate and all dependent jobs.

The Kubernetes environment overlays share one AKS cluster and the
`canada-dental-care-plan` namespace. They are not GitHub deployment environments
or separate clusters. The `shared` overlay provides common resources.

Environment targets are discovered from immediate subdirectories of
`gitops/nonprod/overlays` containing `kustomization.yaml`, `kustomization.yml`,
or `Kustomization`. Names must contain only lowercase letters, digits, and
hyphens. Non-overlay directories are ignored; `shared` is handled separately.
Change-detection filters are generated from these directories, so adding an
overlay does not require editing the workflow's target list or apply steps.

This workflow replaces TeamCity's **Synchronize all environments** job, which
already watches `gitops/nonprod/**` on the default branch and applies all eleven
overlays, including `shared`, using `kubectl apply --kustomize ... --force`.
TeamCity is paused for this CI handoff; this is not a new manifest source-path
cutover.

Merging the workflow into `main` activates GitHub deployment.
The merge changes the workflow file, selecting shared resources and all
discovered environments for the first run. No separate activation flag is required.
Before merging, confirm GitHub's target settings and deployment credentials,
runner tools, Vault access, and AKS permissions. Confirm that no TeamCity build
is still running, and keep that job paused. GitHub's concurrency lock does not
coordinate with TeamCity.

Push deployments select targets as follows:

- Changes under an environment overlay select that environment only.
- Changes under `gitops/nonprod/base/**` select all discovered environment overlays.
- Changes to the shared overlay or its maintenance, reloader, or squid-proxy
  bases select shared deployment.
- Workflow changes, manual runs, reusable calls, and branch-creation pushes
  select shared resources and all discovered environments.

One deployment job uses one ARC runner, checkout, Vault fetch, and Azure login
for all selected overlays. Selected shared resources are applied first; a failure
there blocks environment steps. Skipping unchanged shared resources does not
block selected environments. Selected environments are applied in alphabetical
order by one Bash loop, with a collapsible log group for each overlay. An
environment failure does not stop the remaining selected environments, but the
job reports failure after all have been attempted.

The run's job summary lists Success or Failed for each attempted overlay,
including `shared`, and names failed environment overlays. Apply steps write
these results to `GITHUB_STEP_SUMMARY` before returning a failure. Detailed
kubectl output remains in the step logs and per-overlay log groups.

The complete deployment job has a 20-minute timeout. Reusing one runner avoids
repeated runner provisioning and authentication when the ARC pool effectively
processes jobs one at a time. Runs targeting the same cluster are serialized,
with up to 100 pending runs retained and no cancellation of active runs.

Vault supplies deployment credentials `SPN_ID` and `SPN_PASSWORD` from
`canada-dental-care-plan/data/SPN`. External Secrets Operator retrieves application
secrets through the cluster's `vault-backend` SecretStore; CI does not generate
application-secret files. The deployment job creates a private temporary Azure
configuration directory and kubeconfig file, shared by its apply steps.
Best-effort cleanup removes both;
forced runner termination can prevent cleanup.
The optional `debug` input prints tool versions and allowlisted GitHub and runner
context. It does not dump the full environment or print secret values.

This workflow does not deploy production. A successful live
GitHub deployment has not been verified; check the first run after the handoff.

### Production GitOps deployment

**GitOps operator (prod)**, defined in [gitops-main-prod.yaml](gitops-main-prod.yaml),
replaces TeamCity's **Synchronize `prod` environment** deployment. Pushes to `main`
that change `gitops/prod/**` or the workflow itself trigger an apply of the single
root Kustomization using `kubectl apply --kustomize ./gitops/prod/ --force`.
Manual and reusable runs also apply that Kustomization and must target `main`.
Fork repositories skip the prerequisite gate and dependent deployment job.

The job uses `arc-runners-dshp-prod`, has a 20-minute timeout, and shares a
cluster-keyed concurrency group across its triggers, retaining queued runs without
cancelling active deployments. It fetches only `SPN_ID` and `SPN_PASSWORD` from
`canada-dental-care-plan/data/SPN` in the production Vault instance. Application
Secrets remain managed by External Secrets Operator through `vault-backend`;
the workflow does not fetch application secrets or generate secret files.
ACR login is omitted because this workflow neither builds nor pushes images.

Azure configuration and kubeconfig are private temporary paths with best-effort
cleanup. Optional debug output is restricted to allowlisted context and tool
versions. The job summary reports apply success or failure; a successful apply
does not prove workload readiness or successful ExternalSecret reconciliation.

Before merging, configure `PROD_AKS_CLUSTER_NAME`, `PROD_AKS_RESOURCE_GROUP`,
`PROD_AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, and the `PROD_VAULT_*` secrets.
Verify Vault access, runner connectivity/tools, and service principal AKS permissions.
Pause the TeamCity production sync job and confirm no run is active. GitHub's lock
does not coordinate with TeamCity. Merging this workflow into `main` activates
production deployment. Live AKS deployment and workload health still
need verification; no live deployment was performed during implementation.

## Manual runs and retries

Run dispatch-enabled workflows from the Actions UI or GitHub CLI:

```bash
gh workflow run nightly-e2e.yaml
gh workflow run build-publish-main-nonprod.yaml --ref main -f version=1.2.3
gh workflow run gitops-main-nonprod.yaml --ref main
gh workflow run gitops-main-prod.yaml --ref main
gh workflow run build-publish-tag-prod.yaml --ref v1.2.3
```

The selected ref must contain the workflow. Scheduled and `workflow_run`
workflows must exist on the default branch to receive their automatic events.

The SharePoint workflow has no manual dispatch trigger. Retry an
existing failed run through **Re-run failed jobs** in Actions. SharePoint retries
reuse the original PROD run and attempt without rebuilding or publishing images.
Reports must still exist; expired or deleted artifacts cannot be recovered by
rerunning the uploader. Uploading the same release tag overwrites its ZIP.

## Required configuration

Configure GitHub variables for the workflows that use them:

| Variables                                                | Usage                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `AZURE_TENANT_ID`                                        | Azure and SharePoint application tenant.                                                |
| `NONPROD_ACR_DOMAIN`, `NONPROD_AZURE_SUBSCRIPTION_ID`    | Nonprod image publication; the subscription is also used for nonprod GitOps deployment. |
| `PROD_ACR_DOMAIN`, `PROD_AZURE_SUBSCRIPTION_ID`          | PROD image publication; the subscription is also used for production GitOps deployment. |
| `NONPROD_AKS_CLUSTER_NAME`, `NONPROD_AKS_RESOURCE_GROUP` | Main-branch dev/int1 deployment restarts and nonprod GitOps deployment.                 |
| `PROD_AKS_CLUSTER_NAME`, `PROD_AKS_RESOURCE_GROUP`       | Production GitOps deployment target.                                                    |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_SITE_URL`            | SharePoint site URL, not a library view or Graph endpoint.                              |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_FOLDER`              | Decoded folder path, such as `Shared Documents/CDCP/Test Results`; use literal spaces.  |

GitHub secrets provide Vault access: `NONPROD_VAULT_URL`,
`NONPROD_VAULT_APPROLE_ROLE_ID`, `NONPROD_VAULT_APPROLE_SECRET_ID`, and the
corresponding `PROD_VAULT_*` secrets. AppRoles must read the relevant Azure,
Aqua, Cosign, and SharePoint secrets in their selected Vault instance.

SharePoint credentials reside at
`canada-dental-care-plan/data/shared/cicd/sharepoint`: `SHAREPOINT_CLIENT_ID`,
`SHAREPOINT_CLIENT_CERT_PFX` (base64-encoded PFX), and
`SHAREPOINT_CLIENT_CERT_PFX_PASSWORD`. The application needs a valid certificate
and SharePoint application write access to the destination; Graph permissions
alone may not suffice. Never put credential values in Git or logs.

## Reports and runners

Test and scan artifacts have seven-day retention. PR and nonprod workflows
upload separate Vitest coverage and Playwright artifacts; nightly runs upload
Playwright reports. PROD uploads `test-reports-<run-id>-<run-attempt>`, containing
coverage, Playwright HTML reports, and test results for the SharePoint uploader.

Validation uses GitHub-hosted runners. Nonprod publishing
and GitOps deployment use
`arc-runners-dshp-dev`; production GitOps, PROD publishing, and SharePoint use
`arc-runners-dshp-prod`. Self-hosted runners need the tools and network access
used by their jobs.

Self-hosted runners must be version `2.327.1` or newer for the Node.js 24
runtime used by Vault v4 and Trivy's nested cache actions. The shared
[aqua-scan action](../actions/aqua-scan/action.yaml) pins Trivy action v0.36.0
for Node.js 24-compatible caching;
update the scanner version separately from the action runtime.

GitOps deployment requires Azure CLI, kubectl, kubelogin,
Vault and Azure connectivity, and network access to the target AKS API. The
service principal must be authorized to obtain cluster credentials and apply
resources in `canada-dental-care-plan`.

The SharePoint upload requires Docker with `linux/amd64` support and access to
Docker Hub; its CLI image is pinned by digest.

Every workflow gates execution through `check-repository` to skip repositories
marked as forks. This is an operational safeguard, not a security boundary;
fork PRs running in the parent repository are not blocked by this check.

Aqua scannercli is advisory: publishing may continue after scanner failure.
Successful image publication or signing does not establish Aqua compliance.

## Shared actions

### Dependency updates with Renovate

[Renovate](renovate.yaml) uses
[`renovatebot/github-action`](https://github.com/renovatebot/github-action) and
[repository policy](../renovate.json) for dependency update PRs.
[Dependabot configuration](../dependabot.yml) is retained for rollback, with
`open-pull-requests-limit: 0` in every ecosystem entry to pause new version-update
PRs. Existing Dependabot PRs are not automatically closed by this setting.
Dependabot security-update PRs and GitHub alerts remain independently enabled
until Renovate security-fix readiness is verified. Routine Renovate writes are
controlled by the repository variable `RENOVATE_ENABLED`.

#### Scope and update policy

The configuration extends `config:best-practices`,
`customManagers:githubActionsVersions`, `:semanticCommits`, and `:automergeAll`.
The best-practices baseline includes
`config:recommended`, the Dependency Dashboard, curated grouping, replacement
rules and workarounds, changelog helpers, Docker digest and action-SHA pinning,
configuration-migration PRs, development-dependency pinning, abandonment checks,
npm release-age protection, and weekly lockfile maintenance. The custom-manager
preset adds annotated workflow-version updates.

`:semanticCommits` explicitly enables Conventional Commit formatting for
Renovate PR titles and commits instead of depending on history detection.
The inherited prefix rules select `fix` for recognized production dependency
types and `chore` for other updates; catalog entries retain their catalog types.
The final squash message still depends on GitHub's repository settings and
maintainer edits.

##### Formatting before dependency commits

Renovate runs `pnpm format:write` once per update
branch through `postUpgradeTasks`, after dependency/lockfile updates and before
creating its commit. The root script uses Oxfmt's nested configuration and
ignore-file discovery. It formats the whole repository, so the dependency
commit may include unrelated formatting corrections. The formatter ignores
the generated pnpm lockfile.

The workflow reads the root minimum Node.js version and exact pnpm version into
`RENOVATE_CONSTRAINTS`; Renovate's `postUpgradeTasks.installTools` provisions
those tools using Containerbase. Before formatting, it
installs all workspace packages and the root with
`pnpm install --recursive --include-workspace-root --frozen-lockfile --ignore-scripts` so the
workspace-pinned Oxfmt and its configuration imports are available. The first
formatting task in a run may therefore require dependency downloads; this
installation does not enable lifecycle scripts.

The frontend's nested Oxfmt config loads Tailwind CSS and its plugins from frontend
dependencies. A root-only install is insufficient; do not replace the recursive
install with `pnpm install --workspace-root`. Oxfmt can emit plugin-resolution
warnings without a failing exit code, so check dry-run logs for those warnings too.

The workflow allows only the exact `pnpm install --recursive --include-workspace-root --frozen-lockfile --ignore-scripts`
and `pnpm format:write` commands through `RENOVATE_ALLOWED_COMMANDS`; arbitrary
post-upgrade commands and shell execution are not enabled. These commands run
the repository's root format script and formatter configuration, so protect
those files like workflow code.
Provisioning, installation, or formatting failures become Renovate artifact
errors and require maintainer attention. Verify the task in a full dry run
before activating write runs; existing formatting CI remains the final check.

An npm-manager-only package rule adds application-style exact-version pinning,
including shared pnpm catalog entries. Renovate proposes removing version ranges
and subsequently updating exact catalog versions alongside the lockfile, rather
than updating only in-range lockfile resolutions. Engines and peer dependency
declarations retain `rangeStrategy: auto`. A shared catalog entry still has a
catalog dependency type, so a peer consumer does not automatically exempt that
entry from pinning. The configuration does not use
`:pinAllExceptPeerDependencies` because it would also pin Terraform runtime and
provider constraints. Terraform and
other managers retain their inherited range strategies. This rule does not bypass
the production exclusion or private-registry rules.

File discovery uses Renovate's default enabled managers and file patterns, except
that `gitops/prod/**` is ignored entirely and Kubernetes deployment YAML discovery
is explicitly limited to `gitops/nonprod/**`. Other new supported dependency files
can be discovered without updating this configuration.

- npm dependencies in the root/frontend pnpm workspace, including the centralized
  catalog and root lockfile.
- Images in Dockerfiles, including the lowercase `frontend/dockerfile`, and
  supported Docker Compose files, including `frontend/compose.otel-local.yaml`.
  Docker updates follow the enabled managers' default behavior; major updates
  are not excluded.
- Terraform declarations and associated lockfiles under `infrastructure/`;
  Terragrunt files are also eligible under default manager discovery.
- External GitHub Actions in workflow files and nested composite action metadata.
  Keep full commit-SHA pins with release-version comments. Action major updates
  remain eligible. Supported runner and language-runtime inputs follow the
  GitHub Actions manager's default behavior.
- The pinned Renovate runtime itself, through the custom-manager preset. It
  recognizes explicitly annotated `_VERSION` variables in supported workflow
  and composite-action files, not arbitrary environment variables. Currently only
  the Renovate runtime is annotated. Its version lookup uses GitHub releases,
  which provide publication timestamps for the three-day release-age check;
  the action still downloads that version's container image from GHCR.
  Runtime upgrades are limited to the weekly Monday 00:00-03:59 UTC window.
  `updateNotScheduled: false` also prevents refreshing existing runtime PRs outside
  that window, avoiding hourly version churn. This restriction applies only to
  the custom runtime dependency, not the action wrapper or the workflow cadence.
  The action wrapper and runtime are updated
  separately. Kubernetes and Kustomize can discover nonprod GitOps images;
  production remains excluded.

Production promotion is a separate human-controlled PR after validation in
nonprod. All `gitops/**` updates have a permanent `automerge: false` override and
no inherited cross-file grouping, independently of the global automerge policy.
A nonprod GitOps PR still triggers deployment when manually merged;
review its rendered overlays first. Dependency updates outside GitOps retain
their inherited grouping and automerge policy.

Trivy action updates use a narrowly scoped datasource override:
`aquasecurity/trivy-action` is looked up through public Git tags instead of
App-authenticated GitHub GraphQL. Aqua's organization IP allowlist rejects the
runner's authenticated API requests even though the public Git repository is
accessible. The override retains the original action name, release-version
comment, and full commit-SHA pin; annotated tags resolve to their underlying
commit rather than the tag-object SHA. It does not add a PAT or broaden App
permissions. Because Renovate's `git-tags` datasource provides no publication
timestamps, only this action is exempt from the three-day release-age check.
All other dependencies retain their existing age policies. Verify the first
workflow run after this change has no Trivy lookup warning; changelog API calls
may still be restricted even when tag and digest updates succeed.

All Docker images under the private nonprod registry
`dtsrhpdevscedacr.azurecr.io/**` are explicitly disabled before update lookup.
Application builds and reviewed environment promotion own those tags; Renovate
does not need ACR credentials to inspect or update them. Images from other
registries remain eligible under the existing policies.

The annotation must be immediately above the version variable:

```yaml
# renovate: datasource=github-releases depName=renovatebot/renovate versioning=semver
RENOVATE_VERSION: 44.175.2
```

Ordinary updates have a three-day minimum release age. Release timestamps are
required by default, so updates without timestamps can remain blocked. Digest
updates to `gcr.io/distroless/nodejs26-debian13` are the explicit exception: GCR does not
provide release timestamps through Renovate's Docker datasource, so those
updates use `timestamp-optional` and are eligible on each scheduled run.
Their release age cannot be enforced. Other registries without
timestamps need maintainer review rather than a global bypass. This is not an
exact equivalent of Dependabot's cooldown.

The frontend runtime uses
`gcr.io/distroless/nodejs26-debian13@sha256:...`, so its full image name
matches the Distroless rule. Renovate can refresh the pinned digest;
Node.js 26 and Debian 13 are encoded in the image name, not its tag.
This rule does not automatically migrate to a different Node.js major or Debian
release. The Dockerfile's non-root user and OpenTelemetry startup imports remain
unchanged.

Update PRs receive the `renovate` label; security-fix PRs additionally receive
`security`. Create these repository labels before activation.
For npm datasources, `security:minimumReleaseAgeNpm` uses strict internal-check
filtering to exclude releases that have not satisfied the three-day age check
from update selection. It also documents exceptions for update types where
Renovate cannot enforce release age, including lockfile maintenance, replacements,
pinning, bumps, lockfile updates, and rollbacks. These exceptions do not disable
pnpm's independent safeguards. The global three-day delay remains in effect
for other ecosystems.
The configuration enables automerge for Renovate update PRs, including major
upgrades, security fixes, and lockfile maintenance, using PR-based squash merging.
GitOps updates and infrastructure lockfile maintenance are excluded from automerge.
The temporary one-PR
rollout limits have been removed; the pinned Renovate runtime's defaults allow
10 concurrent normal update PRs and two new normal update PRs per hour.
Security-fix PRs have independent limits and can bypass the normal PR budget.
Weekly lockfile maintenance uses the preset's default
Monday 00:00-03:59 UTC window. Additional hourly workflow runs at minute 17
during that window cover both lockfile maintenance and Renovate runtime updates
without a configuration override. These runs use UTC explicitly so Toronto
daylight-saving changes do not shift them outside the window.
GitHub may delay or skip scheduled runs; manual dispatch
is available when processing is urgent.
pnpm still enforces its release-age and trust policies during lockfile refreshes.

Weekly maintenance uses separate branches and PRs:

- `renovate/npm-lock-file-maintenance` refreshes application lockfiles and retains
  the normal PR-based squash automerge policy, subject to required checks and reviews.
- `renovate/terraform-lock-file-maintenance` refreshes infrastructure provider
  lockfiles, including those used by Terragrunt, and always requires manual merging.

Both retain the inherited Monday window. Infrastructure maintenance has
`automerge: false` independently of GitOps rules and is not grouped into the
application maintenance branch. Refreshing a Terraform lockfile can upgrade
providers within declared ranges; frontend CI does not validate those changes.
Review provider release notes and run the appropriate infrastructure validation
and an authorized nonprod plan before merging. Do not apply infrastructure merely
to validate the PR. After this configuration reaches `main`, rerun Renovate to
replace an existing mixed maintenance PR with the separate proposals.

Renovate creates the Dependency Dashboard on the first write run. It lists
pending updates and repository problems. Dry runs do not create it.

The `:automergeAll` preset enables global automerge. The default
`automergeType: "pr"` and explicit `automergeStrategy: "squash"` apply to
Renovate update PRs.
The default `platformAutomerge: true` lets GitHub
wait for all applicable merge requirements rather than waiting for another
Renovate run. It does not grant the App permission to bypass those requirements.
With the current `main` rules, required `build-frontend` and `test-frontend`
checks, an authorized approval satisfying code-owner review, resolved review
threads, and signed-commit requirements still apply. A failed check or missing
approval leaves the PR unmerged; a new push dismisses stale approvals.
Do not grant the App blanket ruleset bypass to remove the approval step.
There is no weekly Distroless restriction. Confirm the first eligible PR actually
queues GitHub squash auto-merge after activation.

npm and other supported dependencies inherit `group:monorepos` and
`group:recommended` through the best-practices baseline for Renovate-maintained
monorepo and related-package grouping. Examples include React Router, Tailwind CSS,
Vitest, Playwright, and Testing Library. The preset generally matches upstream
source URLs, with package-name matchers for some groups; matching source metadata
must be available for source-based rules. Preset group names are used.

There are no custom grouping rules. OpenTelemetry core and contrib follow their
separate inherited monorepo groups. React runtime and corresponding type packages
are grouped together by the inherited `group:reactMonorepo` and `group:react`
presets.

Packages not matched by a preset receive individual updates.
Scope membership alone no longer groups packages such as `@fortawesome/*` or
`@vitejs/*`; their resolved metadata and the curated preset determine membership.
The shared catalog remains centralized, with no duplicate package inventory.
The monorepo preset groups digest, patch, minor, and major updates; other inherited
rules use their own matching criteria.
Renovate's default `separateMajorMinor: true` keeps major updates separate from
minor/patch updates, but multiple packages' major updates can be grouped.
There is no Docker-major exclusion; Docker majors remain eligible, subject to
the Distroless schedule/age exception and other inherited rules. Grouping only
applies where an inherited preset matches.

#### GitHub App and credentials

Use the organization-owned **STN-DTS Renovate** App. Disable webhooks and user
authorization; restrict installation to the STN-DTS account and select only
approved repositories, initially `canadian-dental-care-plan`.

Following [Renovate's App guidance](https://docs.renovatebot.com/modules/platform/github/#running-as-a-github-app),
grant repository Administration read, Metadata read, Dependabot alerts read,
Checks read/write, Commit statuses read/write, Contents read/write, Issues
read/write, Pull requests read/write, and Workflows read/write. Grant organization
Members read. Merge-queue permission is not needed for this setup. Do not grant
branch-protection bypass.

| Setting                    | Location                                                  | Purpose                                                                      |
| -------------------------- | --------------------------------------------------------- | ---------------------------------------------------------------------------- |
| `RENOVATE_APP_CLIENT_ID`   | Organization Actions variable, selected repositories only | App Client ID, not its numeric App ID                                        |
| `RENOVATE_APP_PRIVATE_KEY` | Organization Actions secret, selected repositories only   | Complete generated PEM private key                                           |
| `RENOVATE_ENABLED`         | Repository Actions variable                               | Set to `false` during validation; `true` enables scheduled/manual write runs |

Each workflow requests an installation token for its own repository, not the
entire organization. App-created PRs can trigger normal CI, unlike PRs created
using the default workflow token. Checkout does not persist credentials. Package
installation scripts are disabled. API-based App commits are enabled.

The reusable App shares a private-key trust boundary: anyone able to extract
that key can mint tokens for other repositories in its installation. Grant the
organization secret only to trusted repositories. New repositories must be
added separately to the App installation and both credential access lists;
their activation variable remains independent. Use separate Apps when stronger
credential isolation is required.

For key rotation, generate a replacement key, update the organization secret,
verify authentication in the consuming repositories, and revoke the previous
key. Never put keys or installation tokens in Git or logs.

#### Validation and cutover

Logging defaults to `info` for scheduled and manual runs. For detailed
troubleshooting logs, check **debug** under **Actions > Renovate > Run workflow**
or pass `-F debug=true` to `gh workflow run`. Scheduled runs always use `info`.

1. Merge the configuration and workflow into the default branch while
   `RENOVATE_ENABLED` remains `false`. Non-default branch runs are skipped.
   No push or PR event starts this privileged workflow.
2. Run **Actions > Renovate > Run workflow** on the default branch, keeping
   **dry_run** checked (the default) and checking **debug** for validation.
   CLI equivalent:
   `gh workflow run renovate.yaml --ref main -F dry_run=true -F debug=true`.
   This full dry run must not create branches, PRs, or dashboard issues.
3. Inspect debug logs for root/frontend catalog extraction and the root lockfile,
   both Docker stages, Compose service images, Terraform declarations, workflow
   and composite actions, and the Renovate runtime. Confirm related-package grouping,
   age eligibility, default Docker update eligibility (including majors),
   alert access, tool compatibility, and absence of artifact-update
   errors. Do not treat extraction alone or a green job as proof that every
   dependency can be updated.
4. Verify direct and transitive pnpm security-fix proposals against available
   GitHub alerts. If no suitable live alert exists, record the gap and test
   fixtures without introducing vulnerable dependencies into the repository.
   Keep Dependabot security updates active until security-fix readiness is proven.
5. For version-update cutover, keep Dependabot's configuration with
   `open-pull-requests-limit: 0` in every ecosystem entry. Set
   `RENOVATE_ENABLED=true` and run the workflow with **dry_run** unchecked.
   Keep **Dependabot security updates**, **Dependency graph**, and **Dependabot
   alerts** enabled. Disable Dependabot security-update PRs only in a separately
   coordinated change after Renovate security-fix readiness is verified.
6. Verify an App-authored PR triggers existing PR checks and that npm updates
   include a working root lockfile (`pnpm install --frozen-lockfile`). Inspect
   the first scheduled run. Close existing Dependabot PRs only after confirming they
   duplicate Renovate replacements; do not bulk-close security PRs. Confirm signed
   commits and App-requested squash auto-merge obey required CI and reviews before
   removing temporary rollout limits. The committed policy now uses default limits.

Runs are serialized without cancelling an in-progress run. Forks skip the
prerequisite gate and dependent job. Missing credentials fail explicitly.
The workflow polls GitHub every 15 minutes on weekdays from 08:00 through 16:59
in `America/Toronto`, plus hourly on Mondays from 00:17 through 03:17 UTC,
for existing PRs, conflicts, checks, and new
dependency versions; no persistent Renovate service or webhook receiver is
required. `rebaseWhen: "auto"` and `updateNotScheduled: true` retain their defaults
for maintaining existing PRs. New branch pushes rerun relevant PR checks and can
dismiss stale approvals under the repository rules. A scheduled check without a
branch update does not itself rerun application CI. GitHub platform auto-merge can
complete an approved, passing PR between Renovate runs.
The job has a 50-minute timeout because installation tokens expire after one
hour.

#### Security fixes and recovery

Renovate reads GitHub's Dependabot alerts; it does not replace the alert scanner.
Security-fix PRs are ungrouped, eligible for squash auto-merge after required
checks and approvals, and use the lowest fixed version.
The configuration enables alerts and relies on Renovate's built-in security
defaults for immediate PR creation, no grouping, and no release-age gate; global
automerge follows the global PR-based squash policy. Processing still happens only
when the workflow runs; dispatch a manual write run for urgent fixes once
Renovate is enabled.

pnpm's independent release-age, trust, build, and override policies remain in
force. A young security fix may fail lockfile generation even when Renovate
considers it eligible. Inspect artifact errors and the Dependency Dashboard;
review a package-and-version-specific `minimumReleaseAgeExclude` exception when
necessary. Do not weaken the global pnpm policy or automatically bypass it.
Some transitive fixes or ecosystems may not be supported; unresolved alerts and
artifact failures require maintainer review.

If authentication, security-fix processing, or CI triggering fails after cutover,
set `RENOVATE_ENABLED=false` and remove `open-pull-requests-limit: 0` from each
retained Dependabot entry (or set a positive limit) through a reviewed change.
This resumes version-update PRs without reconstructing the original schedules
and groups. Keep Dependabot security updates enabled during the transition;
re-enable them if they were disabled in a later security cutover. Keep GitHub
alerts enabled throughout recovery.

### Shared action responsibilities

| Action                                                              | Responsibility                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [azure-acr-login](../actions/azure-acr-login/action.yaml)           | Authenticate with Vault-managed credentials; callers clean up credential directories. |
| [generate-build-vars](../actions/generate-build-vars/action.yaml)   | Generate versions, revisions, timestamps, and RC labels.                              |
| [aqua-scan](../actions/aqua-scan/action.yaml)                       | Run Trivy/Aqua scans and publish reports.                                             |
| [push-container-image](../actions/push-container-image/action.yaml) | Push tags and return the primary immutable image digest.                              |
| [sign-container-image](../actions/sign-container-image/README.md)   | Sign and verify image digests with environment-specific public keys.                  |
