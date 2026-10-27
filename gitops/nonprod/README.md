# Nonproduction GitOps

This tree contains the manifests for dev, int1, int2, otto, perf, prototype,
shared, staging, training, uat1, and uat2. Production does not use these bases
or overlays. Do not synchronize changes into production.

From the repository root, render an environment with
`kubectl kustomize gitops/nonprod/overlays/{environment}`.

The old `gitops/base/` and `gitops/overlays/` directories no longer exist.
TeamCity already uses `gitops/nonprod/overlays/{environment}`, so the move
to GitHub deployment does not change the manifest paths.

## Redis startup workaround

Overlays that use `base/redis` run `base/redis/configs/start-redis.sh` before the
official image entrypoint. `CONFIG REWRITE` saves the image's four bundled
`loadmodule` directives in the Redis configuration. The entrypoint adds those
modules again on restart, which causes Redis to abort. The startup script removes
the saved directives before calling the entrypoint.

The startup script preserves authentication, replication, file ownership, and
permissions. It rejects bundled module directives with custom arguments rather
than discard them. Sentinel startup, image tags, storage, and initialization
remain unchanged. Production does not use this base.

Render int1 without deploying it:

```sh
kubectl kustomize gitops/nonprod/overlays/int1 >/dev/null
```

### Run the optional regression check

`base/redis/tests/redis-startup.sh` reproduces the bug and checks the workaround.
The ConfigMap and StatefulSet do not reference it. You can delete the test script
without affecting deployment or Redis startup. Keep
`base/redis/configs/start-redis.sh`, its ConfigMap entry, and its StatefulSet
command and volume mount. Those files and settings run the workaround.

The test requires Bash and Podman. It needs no cluster credentials, Kubernetes
access, or local Redis installation. If the image is not cached, Podman needs
registry access to download it.

From the repository root, run:

```sh
bash gitops/nonprod/base/redis/tests/redis-startup.sh
```

The test uses `redis:8.10.3-trixie` by default to reproduce the failure without the workaround.
It then runs two cycles of `CONFIG REWRITE` and restart through the startup
script. It checks data, authentication, replication settings, file ownership,
permissions, non-root Redis execution, and invalid configurations.

The container uses a read-only root filesystem, temporary data directories,
synthetic data, and a test password. It mounts only the two scripts, publishes
no ports, and has no external network access. Podman removes it when the test exits.

Success prints `PASS:` messages and exits with status `0`. The last message is:

```text
PASS: missing configuration fails explicitly.
```

The duplicate-module crash and rejected invalid configurations are expected.
A nonzero exit status means the test failed. Read the error output and Redis
log excerpt before changing the workaround.

To check another affected image, set `REDIS_TEST_IMAGE`:

```sh
REDIS_TEST_IMAGE=docker.io/library/redis:8.10.3-trixie bash gitops/nonprod/base/redis/tests/redis-startup.sh
```

The test expects the unmodified entrypoint to reproduce the bug.
If a future image fixes it, update that expectation and confirm repeated
restarts work before removing the workaround.

### Validate after deployment

Merging a base change into `main` selects all nonproduction environments for
deployment. After deployment, check Redis pod readiness, the Redis and Sentinel
logs, and an application session round trip.

Run disruptive checks only in nonproduction during an approved test window.
Run `CONFIG REWRITE`, then restart only the Redis server container.
Do not recreate the pod. Pod recreation reruns init and does not test the same
failure path.

The base defines one Redis replica. The local test does not verify Sentinel
failover or fix init's ordinal-based role assignment. Test both in an environment
with multiple replicas before promoting the workaround to production.

## Container images

Shared Squid, maintenance-page, and 404-page images use version tags and
multi-platform digest pins. The Docker Hub tags were more than three days old
when selected. Maintenance and 404 overlay overrides use the same pins.
Squid uses Canonical's `6.6-24.04_edge` image on Ubuntu 24.04 LTS.
The upstream `_edge` tag does not guarantee a stable release.

Fluentd archivers and frontend sidecars in perf and staging use the same
`docker.io/fluentd:v1.19.3-debian-1.0` multi-platform digest pin.
The image was more than three days old when selected. Perf upgrades from 1.16.
Check log forwarding and archive writes after deployment.
Production image references remain unchanged.

Renovate proposes nonproduction image updates without automerge.
Render the affected overlays before merging. A merge to `main` triggers
deployment. Renovate excludes production. Promote tested pins through a separate
reviewed production change.

## Automated deployment

The [GitOps operator (nonprod) workflow](../../.github/workflows/gitops-main-nonprod.yaml)
deploys this tree to one nonproduction AKS cluster in the
`canada-dental-care-plan` namespace. Every run must use `main`.

The workflow replaces TeamCity's **Synchronize all environments** job, which
is paused for this handoff. Merging the workflow into `main` deploys shared
resources and all ten environments. Before merging, check the target cluster,
credentials, runner tools, and cluster access. Confirm that no TeamCity build
is running. Keep TeamCity paused. GitHub's concurrency lock does not cover
TeamCity builds.

The workflow discovers environment directories containing a Kustomization under
`gitops/nonprod/overlays`, excluding `shared`. It includes new overlays without
changes to workflow filters or apply steps. It ignores directories without a
Kustomization.

On pushes, overlay changes select the affected environments. Base changes select
all discovered environments. Changes to `shared` or its referenced bases select
shared deployment. Workflow-file changes select all overlays.

Selected overlays use one runner and Azure authentication session.
If selected, shared deployment must succeed before environment deployment starts.
Skipping unchanged shared resources does not block the selected environments.
The workflow deploys environments one at a time in alphabetical order and groups
logs by overlay. If an environment fails, deployment continues for the remaining
environments, but the job fails overall. The job has a 20-minute timeout.

Manual and reusable runs apply shared resources and all environments. From the
repository root, request a manual run with:

```shell
gh workflow run gitops-main-nonprod.yaml --ref main
```

The workflow fetches Azure deployment credentials, not application secrets.
External Secrets Operator supplies those from Vault through `vault-backend`.
The workflow does not generate application-secret files or deploy production.

See the [workflow documentation](../../.github/workflows/README.md#nonprod-gitops-deployment)
for selection rules, GitHub configuration, runner tools, and cleanup.
Live GitHub deployment remains unverified. Check the first run after merging.
Local rendering does not verify deployment access.

## Workflow rollback

Revert the affected manifest changes and merge the revert into `main`.
The resulting push deploys the selected overlays. A manual run from `main`
reapplies all overlays. The prerequisite gate rejects older branches and tags
because it accepts only `refs/heads/main`.

Reverting manifests does not delete resources that the original change created.
Review resource removals before rollback.

## Secret management

External Secrets Operator creates the frontend, OAuth proxy, and Redis Secrets
from Vault through `vault-backend`. Bases and overlays do not generate Secret
placeholders or require secret-input files. ConfigMap generators supply
application configuration.

The frontend base loads
[secret-name-references.yaml](base/frontend/secret-name-references.yaml), which
rewrites `envFrom.secretRef.name` using `ExternalSecret` names for Deployment
and StatefulSet containers, including init containers. For example, `frontend`
becomes `frontend-uat1`, matching the Secret that the operator creates.
Each `ExternalSecret` must use its own name for the target Secret.

During migration, keep live operator-managed Secrets even when their generated
placeholders disappear from rendered manifests. Do not delete or prune them.
For a new deployment, workloads must wait for the operator to create and populate
their Secrets. When rendering an overlay, check that every workload Secret
reference matches an `ExternalSecret` target.
