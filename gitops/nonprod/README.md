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
than discard them. Sentinel startup, image tags, and storage remain unchanged.
Production does not use this base.

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
failover. See the next section for init's role assignment.

## Redis role assignment on pod start

`base/redis/configs/init.sh` runs before Redis and Sentinel in every pod start.
Redis and Sentinel announce pod DNS names, such as `redis-0.redis-headless`,
instead of pod IP addresses. Saved Sentinel state therefore still names the
right pods after they are recreated with new IP addresses. The headless service
sets `publishNotReadyAddresses: true`, so these names resolve while pods are
still starting, such as when every pod restarts at once.

Init chooses the role in this order:

1. **Running Sentinels.** Init asks the Sentinels of the other ready pods, found
   through the headless service, which pod is the current primary. When every
   answering Sentinel agrees, the pod starts as replica of that primary. The
   primary must answer `ROLE` as `master`, or match the primary saved in this
   pod's `sentinel.conf`. If Sentinel reports this pod, it starts as primary
   unless Sentinel is already failing over away from it. When the Sentinels
   disagree or the reported primary is not ready, init waits for up to 90 seconds.
2. **Saved primary.** When no Sentinel answers, such as when every pod restarts,
   or the wait times out, init uses the primary saved in this pod's
   `sentinel.conf`. Sentinel updates that file after every failover. Init ignores
   saved IP addresses written before this change.
3. **StatefulSet ordinal.** On a new volume or with no saved DNS name, `redis-0`
   is primary and the others replicate from it.

Init rebuilds `sentinel.conf` from the template on every start. It seeds the
monitor with the chosen primary and keeps the existing `sentinel myid`.
Without that identifier, the other Sentinels keep a stale entry for every pod
recreation. Stale entries raise the number of votes needed for a failover.
Init makes `sentinel.conf` owned by `redis` because Sentinel rewrites it.

Every node uses the append-only file settings from `primary.conf`, so a
replica that Sentinel promotes keeps its data across restarts. The `replicaof`
line in each overlay's `replica.conf` only seeds the template; init replaces it.

Init does not trace commands, so it does not print the Redis password.

## Redis primary handover on pod stop

When Kubernetes stops the primary pod, such as during a rollout or a node drain,
`base/redis/configs/prestop-redis.sh` hands the primary role to a replica
before Redis stops. If the pod is primary with at least one connected replica,
the hook waits until the Sentinel in the same pod lists a healthy replica, pauses
writes with `CLIENT PAUSE WRITE`, and sends `SENTINEL FAILOVER` to that Sentinel,
retrying until Sentinel accepts it. It then waits for Sentinel to report another
primary. The whole hook stops after 20 seconds. Writes stay paused until Redis
stops, so the former primary accepts no write after the replica is promoted. On
a replica, or a primary without replicas, the hook exits at once.

The replica check comes first because paused writes also block the `PUBLISH`
that Sentinel sends on its link to the primary. Sentinel then stops refreshing
the primary's `INFO`, which is where it discovers replicas. Init rebuilds
`sentinel.conf` without the replica list, so for several seconds after a pod
restarts, Sentinel knows no replica and answers `NOGOODSLAVE`.

Kubernetes runs every container's preStop hook at the same time.
`base/redis/configs/prestop-sentinel.sh` keeps the Sentinel container running
while Sentinel still reports this pod as primary and its Redis still listens, up
to 25 seconds. The Sentinel that receives `SENTINEL FAILOVER` runs the failover,
so it must outlive it. Both hooks fit within the default 30-second termination
grace period.

Without the hooks, clients wait for Sentinel to notice the stopped primary after
`down-after-milliseconds` (5 seconds) before a failover starts. In the Podman
check, the planned handover takes 2 to 3 seconds, or up to about 8 seconds right
after every pod restarted.

### Run the Sentinel rejoin check

`base/redis/tests/redis-sentinel-rejoin.sh` starts three Redis and Sentinel
containers on an internal Podman network with synthetic data. It removes the
primary, waits for Sentinel to promote a replica, and recreates pods with new IP
addresses. It checks that recreated pods replicate from the current primary,
that Sentinel reports pod DNS names, that each Sentinel lists exactly two peers,
and that every node uses the append-only file. It then kills every pod and
starts them again in ordinal order, and checks that the same primary keeps the
last write. It runs both preStop hooks on a replica, which must leave the
primary in place, and on the primary, which must promote a replica in under 5
seconds without losing the last write, and the stopped primary must rejoin as a
replica. Finally, it checks that init logs omit the password.
Podman removes the containers, volumes, and network when the test exits.

From the repository root, run:

```sh
bash gitops/nonprod/base/redis/tests/redis-sentinel-rejoin.sh
```

Success prints `PASS:` messages and exits with status `0` in about two minutes.
Set `REDIS_TEST_IMAGE` to test another image, or `REDIS_CONFIG_DIRECTORY` to
test another copy of `base/redis/configs`.

### Roll out the change

A change to `init.sh` or the preStop hooks changes the Redis ConfigMap name, so
every overlay that uses this base rolls its Redis pods. With three replicas, the
rollout recreates `redis-2`, `redis-1`, then `redis-0`. Recreated pods join the
current primary. When the primary is recreated, Sentinel fails over once and the
former primary rejoins as a replica. Pods keep the preStop hooks of the spec they
were created with, so the first rollout that adds the hooks still uses the
unplanned failover; later rollouts use the planned handover. Existing replicas
switch on the append-only file and rebuild it from the primary during their
first sync.

After deployment, check in perf and staging that `SENTINEL MASTER myprimary`
reports `num-slaves` 2 and `num-other-sentinels` 2, and that
`SENTINEL GET-MASTER-ADDR-BY-NAME myprimary` returns a pod DNS name.

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
