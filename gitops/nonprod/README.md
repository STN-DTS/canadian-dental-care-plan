# Nonproduction GitOps

This tree is the independent source for dev, int1, int2, otto, perf, prototype,
shared, staging, training, uat1, and uat2. Its bases and overlays are complete
copies of the legacy sources so changes here cannot be Kustomize inputs to
production.

Render an environment with `kubectl kustomize ./overlays/{environment}`.
Make nonprod changes only in this tree; do not auto-synchronize them into
production.

The legacy `gitops/base/` and `gitops/overlays/` directories have been removed.
That directory restructure predates this CI handoff. TeamCity already applies
`gitops/nonprod/overlays/{environment}`; replacing its deployment job does not
introduce a new manifest source path.

## Automated Deployment

The [GitOps operator (nonprod) workflow](../../.github/workflows/gitops-main-nonprod.yaml)
applies Kustomizations from this tree to one nonprod AKS cluster, in the
`canada-dental-care-plan` namespace. Every deployment run must use `main`.

The workflow replaces TeamCity's **Synchronize all environments** job, which
is paused for this handoff. Merging the workflow into `main` intentionally
triggers deployment of shared resources and all ten environments. Before
merging, confirm the GitHub target settings, credentials, runner tools, and
cluster access, and verify that no TeamCity build is still running. Keep
TeamCity paused; GitHub's concurrency lock cannot serialize TeamCity builds.

The workflow discovers environment directories containing a Kustomization under
`gitops/nonprod/overlays`, excluding `shared`. New overlays are included without
adding workflow filters or apply steps; directories without a Kustomization are
ignored.

On pushes, environment-overlay changes select those environments; base changes
select all discovered environments. Shared-overlay changes or changes to its referenced
bases select shared deployment. Workflow-file changes select all overlays.
All selected overlays use one runner and Azure authentication session. When
shared deployment is selected, it must succeed before environment steps start.
Skipping unchanged shared resources does not block selected environments.
Environments are applied sequentially in alphabetical order, with grouped logs
for each overlay. A failed environment does not stop the
remaining selected environments, but the overall deployment job fails. The
complete deployment job has a 20-minute timeout.

Manual and reusable runs apply shared resources and all environments. From the
repository root, request a manual run with:

```shell
gh workflow run gitops-main-nonprod.yaml --ref main
```

External Secrets Operator supplies application secrets from Vault through
`vault-backend`. The workflow fetches only Azure deployment credentials and does
not generate application-secret files. Production is not a deployment target.

See the [workflow documentation](../../.github/workflows/README.md#nonprod-gitops-deployment)
for selection rules, required GitHub configuration, runner tools, and cleanup.
A successful live GitHub deployment has not been verified. Check the first run
after merging; local render checks alone do not prove deployment access.

## Workflow Rollback

To roll back a deployment through this workflow, revert the affected manifest
changes and merge the revert into `main`. The resulting push applies the selected
Kustomizations from `main`; a manual run from `main` can reapply all overlays.
Dispatching an older branch or tag is not supported because the prerequisite
gate rejects every ref except `refs/heads/main`.

Applying reverted manifests does not automatically delete resources introduced
by the reverted change. Review resource removals separately before rollback.

## Secret Management

External Secrets Operator creates and populates the frontend, OAuth proxy, and
Redis Secrets from Vault through `vault-backend`. Nonprod bases and overlays do
not generate Secret placeholders or require secret-input files. ConfigMap
generators remain responsible for application configuration.

The frontend base loads
[secret-name-references.yaml](base/frontend/secret-name-references.yaml), which
lets Kustomize rewrite workload `envFrom.secretRef.name` values using
`ExternalSecret` names. This covers Deployment and StatefulSet containers and
init containers. For example, `frontend` becomes `frontend-uat1`, matching the
Secret populated by the operator. This relies on each `ExternalSecret` using
its own name for the target Secret.

When migrating an existing deployment, do not delete or prune the live
operator-managed Secrets because their generated placeholders disappear from
rendered manifests. On a new deployment, workloads must wait until the operator
creates and populates their referenced Secrets. Verify that every workload Secret
reference matches an `ExternalSecret` target when rendering an overlay.
