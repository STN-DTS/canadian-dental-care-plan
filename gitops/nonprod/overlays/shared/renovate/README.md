# Self-hosted Renovate

The official Renovate image runs every 15 minutes in the shared nonproduction
namespace. It ships **suspended**, with `RENOVATE_DRY_RUN=full`, and targets only
`STN-DTS/canadian-dental-care-plan`. No custom image, PAT, extra controller, or
additional CRD is needed.

## How it works

- The existing `vault-backend` SecretStore reads the DSHP dev Vault entry
  `shared/cicd/renovate` under the `canada-dental-care-plan` mount.
  Keep the existing properties `RENOVATE_APP_CLIENT_ID` and
  `RENOVATE_APP_PRIVATE_KEY` (complete PEM). Never put credentials in Git or logs.
- [config.mjs](config.mjs) signs an App JWT using Node built-ins, discovers the
  repository installation, and requests a CDCP-only installation token.
- The same config reads the default branch's root package manifest for Node/pnpm
  versions, preserving post-update formatting for npm and infrastructure changes.
- Renovate loads this config directly; Kubernetes handles process termination.
  API requests time out after 30 seconds; Jobs have a 50-minute deadline and no
  automatic retries. Tokens expire after one hour and are not revoked on exit.
- The cache PVC avoids repeated downloads. No NetworkPolicy is supplied;
  network access follows existing cluster and namespace policies.
  The pod runs non-root without a Kubernetes API token.

The App key can mint tokens for its other installations: CDCP-only token scoping
does not reduce the trust required to hold the private key.

## Deploy and test

Use the [parent shared overlay](../kustomization.yaml), not this child directly:
the parent supplies the namespace and `-shared` suffix. Confirm the nonproduction
context, Vault access, storage provisioning, and outbound network access first.

From the repository root:

```sh
kubectl apply --dry-run=server -k gitops/nonprod/overlays/shared
kubectl apply -k gitops/nonprod/overlays/shared
kubectl -n canada-dental-care-plan wait --for=condition=Ready externalsecret/renovate-app-shared --timeout=120s
kubectl -n canada-dental-care-plan get cronjob renovate-shared
```

Keep the CronJob suspended. Ensure no previous Job is active, then run:

```sh
job="renovate-manual-$(date -u +%Y%m%d%H%M%S)"
kubectl -n canada-dental-care-plan create job "$job" --from=cronjob/renovate-shared
kubectl -n canada-dental-care-plan logs --pod-running-timeout=5m -f "job/$job" -c renovate
kubectl -n canada-dental-care-plan get job "$job"
```

`concurrencyPolicy: Forbid` does not prevent overlapping manual Jobs.
Do not share the cache between concurrent Jobs.

Check logs for real authentication and dependency extraction, not just Job success.
A full dry run must not create branches, PRs, or dashboard issues. If no eligible
update exercises lockfile generation and formatting, that verification remains open.

## Enable writes only after validation

1. Confirm no other Renovate writer or previous Job is running.
2. Change `RENOVATE_DRY_RUN` to the string `'null'` in [cronjobs.yaml](cronjobs.yaml),
   keeping `suspend: true`. Deploy and run one manual Job.
3. Verify an App-authored PR, lockfile generation, formatting, required checks,
   signed commits, and merge policy. Job success alone does not prove artifact updates.
4. Arrange Job-failure/log monitoring before unattended use. Change `suspend` to
   `false` in Git only after validation. The schedule runs every day, including weekends.

To pause immediately:

```sh
kubectl -n canada-dental-care-plan patch cronjob renovate-shared --type=merge -p '{"spec":{"suspend":true}}'
```

Persist suspension in Git. It does not stop active Jobs. Wait for Jobs to finish
before deploying a previous configuration. Keep the existing cache and App
credentials when updating this setup.

## Local checks

```sh
pnpm test --project root gitops/nonprod/overlays/shared/renovate/config.test.mjs
kubectl kustomize gitops/nonprod/overlays/shared >/dev/null
```

Local tests do not establish live Vault access, cluster networking, or successful
dependency PR creation.
