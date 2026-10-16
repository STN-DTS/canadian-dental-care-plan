# GitHub Workflows

CI validation, image publication, GitOps deployment, and reporting for the Canadian Dental Care Plan.

## Workflow Summary

| Workflow                                                                             | Triggers                                                                   | Purpose                                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [pr-checks.yaml](pr-checks.yaml)                                                     | PRs targeting `main` or `release/**`; manual; reusable                     | Check repository formatting for all changes; conditionally validate the frontend, run smoke tests, and build an image without publishing.    |
| [build-publish-main-nonprod.yaml](build-publish-main-nonprod.yaml)                   | Pushes to `main` or `release/v*`; manual; reusable                         | Test, scan, publish, and sign nonprod images. Main promotes `latest` and restarts dev/int1 deployments; release branches promote RC aliases. |
| [gitops-main-nonprod.yaml](gitops-main-nonprod.yaml)                                 | GitOps pushes to `main`; manual; reusable, all restricted to `main`        | Monitor `gitops/nonprod` on `main` and apply selected Kustomizations to the nonprod AKS cluster.                                             |
| [gitops-main-prod.yaml](gitops-main-prod.yaml)                                       | GitOps pushes to `main`; manual; reusable, all restricted to `main`        | Apply the production root Kustomization to the prod AKS cluster.                                                                             |
| [build-publish-tag-nonprod.yaml](build-publish-tag-nonprod.yaml)                     | Pushes of `v*` tags; manual                                                | Test, scan, publish, and sign release-tagged images in nonprod ACR.                                                                          |
| [build-publish-tag-prod.yaml](build-publish-tag-prod.yaml)                           | Pushes of `v*` tags; manual                                                | Test, scan, publish, and sign release-tagged images in PROD ACR.                                                                             |
| [nightly-e2e.yaml](nightly-e2e.yaml)                                                 | Daily at 00:00 UTC; manual                                                 | Build the frontend, run Chromium end-to-end tests, and retain Playwright reports.                                                            |
| [notify-workflow-completion.yaml](notify-workflow-completion.yaml)                   | Requests and completions from explicitly listed repository-owned workflows | Post queued messages and threaded completion results, also broadcast to the channel. Notification failures are non-blocking.                 |
| [upload-prod-test-results-sharepoint.yaml](upload-prod-test-results-sharepoint.yaml) | Successful PROD tag workflow completion                                    | Upload the exact source run's test reports to SharePoint as `<release-tag>.zip`.                                                             |

Slack notifications post **Queued** on `requested`, then the result on `completed`,
including failures and cancellations. An explicit allowlist subscribes only to
repository-owned workflows:

```yaml
workflows:
  - Build, test, and publish nonprod images
  - Build, test, and publish nonprod tag images
  - Build, test, and publish PROD tag images
  - GitOps operator (nonprod)
  - GitOps operator (prod)
  - Nightly e2e tests
  - Upload PROD test results to SharePoint
```

Entries match each workflow's `name`, not its filename. Update the allowlist in
[notify-workflow-completion.yaml](notify-workflow-completion.yaml) and this example
when adding or renaming a workflow that should send notifications. New workflows
are not included automatically. GitHub-managed workflows, such as **Running Copilot
Code Review**, are deliberately omitted: they are outside our control and can
trigger notification runs that require maintainer approval. PR checks are omitted
to reduce noise, and the notifier is omitted to avoid notification loops.

Trusted default-branch code finds the queued parent using
`cdcp_workflow_run` metadata keyed by repository, run ID, and attempt. Completion
replies use `reply_broadcast: true` to appear in both the thread and channel.
Missing parents or lookup failures produce standalone results. GitHub does not
emit `requested` for reruns. Notification failures are non-blocking.

The Slack bot needs channel history access and a registered metadata schema;
see [notification setup](../actions/prepare-slack-completion/README.md#usage).

Tag publishing workflows validate `vX.Y.Z` with an optional suffix. Manual runs
must select a release-tag ref; branch refs are rejected. Pushing a matching tag
triggers both nonprod and PROD publication.

Frontend jobs in PR and nonprod branch workflows use change detection. Publishing
from the nonprod branch workflow is restricted to `main` and `release/v*` refs.

The PR, nonprod branch, and both tag publishing workflows run `check-formatting`
from the repository root in a separate job after the non-fork `check-repository`
gate. Tag formatting jobs also wait for release-tag validation. Formatting runs
independently of frontend tests and, where applicable, frontend change detection.
In PR checks, documentation-, GitOps-, and infrastructure-only changes also
receive the repository-wide Oxfmt check. The nonprod branch workflow retains
its push path filters below.

Frontend tests can run even if formatting fails, but branch and tag image
publishing requires both formatting and frontend tests to succeed. Frontend
test jobs do not repeat the formatting check.

Node jobs install dependencies from the repository root using the shared pnpm
workspace and lockfile. Frontend commands also run from the root and explicitly
select the package with `pnpm --filter @cdcp-rcsd/frontend run <script>`;
Playwright installation uses `pnpm --filter @cdcp-rcsd/frontend exec playwright`.
Container builds use the repository root as their context; the root
`.dockerignore` includes only workspace manifests and frontend build inputs.
Changes to root package, lockfile, workspace, formatter, or Docker context
configuration also enable frontend validation and builds.

### Nonprod Branch Guards

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
All jobs remain dependent on the non-fork `check-repository` gate.

### Nonprod GitOps Deployment

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

Merging the workflow into `main` intentionally activates GitHub deployment.
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

This workflow does not deploy production. Slack notifications report queued runs
and completion results through the notification workflow. A successful live
GitHub deployment has not been verified; check the first run after the handoff.

### Production GitOps Deployment

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
Slack queued/completion notifications use the existing notification workflow.

**Before merging:** configure `PROD_AKS_CLUSTER_NAME`, `PROD_AKS_RESOURCE_GROUP`,
`PROD_AZURE_SUBSCRIPTION_ID`, `AZURE_TENANT_ID`, and the `PROD_VAULT_*` secrets.
Verify Vault access, runner connectivity/tools, and service principal AKS permissions.
Pause the TeamCity production sync job and ensure no run is active: GitHub's lock
does not coordinate with TeamCity. Merging this workflow into `main` intentionally
activates production deployment. Live AKS deployment and workload health still
need verification; no live deployment was performed during implementation.

## Manual Runs and Retries

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

The Slack and SharePoint workflows have no manual dispatch trigger. Retry an
existing failed run through **Re-run failed jobs** in Actions. SharePoint retries
reuse the original PROD run and attempt without rebuilding or publishing images.
Reports must still exist; expired or deleted artifacts cannot be recovered by
rerunning the uploader. Uploading the same release tag overwrites its ZIP.

## Required Configuration

Configure GitHub variables for the workflows that use them:

| Variables                                                | Usage                                                                                   |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `AZURE_TENANT_ID`                                        | Azure and SharePoint application tenant.                                                |
| `NONPROD_ACR_DOMAIN`, `NONPROD_AZURE_SUBSCRIPTION_ID`    | Nonprod image publication; the subscription is also used for nonprod GitOps deployment. |
| `PROD_ACR_DOMAIN`, `PROD_AZURE_SUBSCRIPTION_ID`          | PROD image publication; the subscription is also used for production GitOps deployment. |
| `NONPROD_AKS_CLUSTER_NAME`, `NONPROD_AKS_RESOURCE_GROUP` | Main-branch dev/int1 deployment restarts and nonprod GitOps deployment.                 |
| `PROD_AKS_CLUSTER_NAME`, `PROD_AKS_RESOURCE_GROUP`       | Production GitOps deployment target.                                                    |
| `SLACK_CHANNEL_ID`                                       | Completion notification destination.                                                    |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_SITE_URL`            | SharePoint site URL, not a library view or Graph endpoint.                              |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_FOLDER`              | Decoded folder path, such as `Shared Documents/CDCP/Test Results`; use literal spaces.  |

GitHub secrets provide Vault access: `NONPROD_VAULT_URL`,
`NONPROD_VAULT_APPROLE_ROLE_ID`, `NONPROD_VAULT_APPROLE_SECRET_ID`, and the
corresponding `PROD_VAULT_*` secrets. AppRoles must read the relevant Azure,
Aqua, Cosign, Slack, and SharePoint secrets in their selected Vault instance.

SharePoint credentials reside at
`canada-dental-care-plan/data/shared/cicd/sharepoint`: `SHAREPOINT_CLIENT_ID`,
`SHAREPOINT_CLIENT_CERT_PFX` (base64-encoded PFX), and
`SHAREPOINT_CLIENT_CERT_PFX_PASSWORD`. The application needs a valid certificate
and SharePoint application write access to the destination; Graph permissions
alone may not suffice. Never put credential values in Git or logs.

## Reports and Runners

Test and scan artifacts have seven-day retention. PR and nonprod workflows
upload separate Vitest coverage and Playwright artifacts; nightly runs upload
Playwright reports. PROD uploads `test-reports-<run-id>-<run-attempt>`, containing
coverage, Playwright HTML reports, and test results for the SharePoint uploader.

Validation uses GitHub-hosted runners. Nonprod publishing, GitOps deployment,
and Slack use
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

## Shared Actions

| Action                                                                    | Responsibility                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [azure-acr-login](../actions/azure-acr-login/action.yaml)                 | Authenticate with Vault-managed credentials; callers clean up credential directories. |
| [generate-build-vars](../actions/generate-build-vars/action.yaml)         | Generate versions, revisions, timestamps, and RC labels.                              |
| [aqua-scan](../actions/aqua-scan/action.yaml)                             | Run Trivy/Aqua scans and publish reports.                                             |
| [push-container-image](../actions/push-container-image/action.yaml)       | Push tags and return the primary immutable image digest.                              |
| [sign-container-image](../actions/sign-container-image/README.md)         | Sign and verify image digests with environment-specific public keys.                  |
| [prepare-slack-completion](../actions/prepare-slack-completion/README.md) | Generate completion payloads from source-run metadata and artifact links.             |
