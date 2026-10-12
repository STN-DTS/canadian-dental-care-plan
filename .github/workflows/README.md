# GitHub Workflows

CI validation, image publication, and reporting for the Canadian Dental Care Plan.

## Workflow Summary

| Workflow                                                                             | Triggers                                                                   | Purpose                                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| [pr-checks.yaml](pr-checks.yaml)                                                     | PRs targeting `main` or `release/**`; manual; reusable                     | Detect changes, validate the frontend, run smoke tests, and build an image without publishing.                                               |
| [build-publish-main-nonprod.yaml](build-publish-main-nonprod.yaml)                   | Pushes to `main` or `release/v*`; manual; reusable                         | Test, scan, publish, and sign nonprod images. Main promotes `latest` and restarts dev/int1 deployments; release branches promote RC aliases. |
| [build-publish-tag-nonprod.yaml](build-publish-tag-nonprod.yaml)                     | Pushes of `v*` tags; manual                                                | Test, scan, publish, and sign release-tagged images in nonprod ACR.                                                                          |
| [build-publish-tag-prod.yaml](build-publish-tag-prod.yaml)                           | Pushes of `v*` tags; manual                                                | Test, scan, publish, and sign release-tagged images in PROD ACR.                                                                             |
| [nightly-e2e.yaml](nightly-e2e.yaml)                                                 | Daily at 00:00 UTC; manual                                                 | Build the frontend, run Chromium end-to-end tests, and retain Playwright reports.                                                            |
| [notify-workflow-completion.yaml](notify-workflow-completion.yaml)                   | Workflow requests and completions except PR checks and the notifier itself | Post queued messages and threaded completion results, also broadcast to the channel. Notification failures are non-blocking.                 |
| [upload-prod-test-results-sharepoint.yaml](upload-prod-test-results-sharepoint.yaml) | Successful PROD tag workflow completion                                    | Upload the exact source run's test reports to SharePoint as `<release-tag>.zip`.                                                             |

Slack notifications post **Queued** on `requested`, then the result on `completed`,
including failures and cancellations. Ordered workflow-name patterns include
future workflows automatically:

```yaml
workflows:
  - '**'
  - '!Build and test pull request'
  - '!Notify workflow completions'
```

The positive catch-all must precede the quoted negative patterns. Exclusions
match each workflow's `name`, not its filename; update them when renaming workflows.
PR checks are excluded to reduce noise, and the notifier excludes itself to avoid
notification loops. Trusted default-branch code finds the queued parent using
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

## Manual Runs and Retries

Run dispatch-enabled workflows from the Actions UI or GitHub CLI:

```bash
gh workflow run nightly-e2e.yaml
gh workflow run build-publish-main-nonprod.yaml --ref main -f version=1.2.3
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

| Variables                                                | Usage                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `AZURE_TENANT_ID`                                        | Azure and SharePoint application tenant.                                               |
| `NONPROD_ACR_DOMAIN`, `NONPROD_AZURE_SUBSCRIPTION_ID`    | Nonprod image publication.                                                             |
| `PROD_ACR_DOMAIN`, `PROD_AZURE_SUBSCRIPTION_ID`          | PROD image publication.                                                                |
| `NONPROD_AKS_CLUSTER_NAME`, `NONPROD_AKS_RESOURCE_GROUP` | Main-branch dev/int1 deployment restarts.                                              |
| `SLACK_CHANNEL_ID`                                       | Completion notification destination.                                                   |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_SITE_URL`            | SharePoint site URL, not a library view or Graph endpoint.                             |
| `PROD_SHAREPOINT_TEST_REPORT_UPLOAD_FOLDER`              | Decoded folder path, such as `Shared Documents/CDCP/Test Results`; use literal spaces. |

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

Validation uses GitHub-hosted runners. Nonprod publishing and Slack use
`arc-runners-dshp-dev`; PROD publishing and SharePoint use
`arc-runners-dshp-prod`. Self-hosted runners need the tools and network access
used by their jobs. The SharePoint upload requires Docker with `linux/amd64`
support and access to Docker Hub; its CLI image is pinned by digest.

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
