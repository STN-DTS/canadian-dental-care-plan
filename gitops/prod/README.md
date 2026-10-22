# Production GitOps

This is the standalone production Kustomize root. It owns the effective
production resource definitions and declarative generator inputs; it does not
import nonproduction or the legacy shared base. Render locally with
`kubectl kustomize .`.

Production resources are grouped by kind in `deployments.yaml`, `services.yaml`,
`stateful-sets.yaml`, `pvcs.yaml`, `service-accounts.yaml`, `roles.yaml`,
`role-bindings.yaml`, `hpas.yaml`, and `external-secrets.yaml`. They contain
effective production defaults and logical generator references; Kustomize
updates their ConfigMap hashes when inputs change.
`ingresses.yaml` is the active routing manifest. Maintenance, apply-maintenance,
letters-maintenance, and renew-error variants remain dormant local files.
Through the approved operational workflow, comment out `./ingresses.yaml` and
uncomment exactly one alternative in this root's `kustomization.yaml`; render
and review before deploying. Restore the normal selection to roll back.
TLS secrets are provisioned out-of-band and are not managed by this root.

## Redis startup workaround

The Redis server runs `configs/redis/start-redis.sh` before the official image
entrypoint. `CONFIG REWRITE` saves the image's bundled module directives in
`/data/redis.conf`. The entrypoint adds those modules again on restart, which
causes Redis to abort. The startup script removes the saved directives for
RedisSearch, RedisBloom, RedisTimeSeries, and RedisJSON before calling the
entrypoint with the original arguments.

The script preserves authentication, replication settings, file ownership, and
permissions. It rejects bundled module directives with custom arguments rather
than discarding those arguments. Missing configuration also stops startup.
The ConfigMap includes the script and the Redis container mounts it at
`/etc/start-redis.sh`. Production owns this copy independently of nonproduction.
Sentinel, init, Redis 8.8.0, PVCs, and Secret references are unchanged.

From the repository root, render without deploying:

```sh
kubectl kustomize gitops/prod >/dev/null
```

Run the existing regression harness against the production script with Podman:

```sh
podman run --rm --network none --read-only \
  --tmpfs /data:rw,mode=0777 --tmpfs /tmp:rw,mode=1777 \
  --volume "$PWD/gitops/prod/configs/redis/start-redis.sh:/etc/start-redis.sh:ro" \
  --volume "$PWD/gitops/nonprod/base/redis/tests/redis-startup.sh:/etc/test-redis-startup.sh:ro" \
  --entrypoint bash docker.io/library/redis:8.8.0 \
  /etc/test-redis-startup.sh --container
```

The test uses synthetic data and no production mounts or cluster access.
It reproduces the duplicate-module failure, then checks fresh startup and
repeated rewrites and restarts through the production script. Success prints
`PASS:` messages and exits with status `0`. The test harness is not deployed.

Deploy only through the approved production process. Changing the StatefulSet
template recreates pods and reruns init. Init still overwrites configuration and
assigns roles by ordinal, so this change does not guarantee session continuity
during a rollout. Review the current primary, replica health, and Sentinel quorum
before deployment. A role-aware rollout must update replicas before the primary.
Do not delete PVCs. The nonproduction container-restart and controlled-failover
checks do not establish safe pod recreation after failover.

## Secret Management

External Secrets Operator creates and populates the `frontend`, `oauth-proxy`,
and `redis` Secrets from Vault through `vault-backend`. Their `ExternalSecret`
resources retain the default `creationPolicy: Owner`; this root no longer
generates empty Secret placeholders. ConfigMap generators remain unchanged.

Production uses no environment suffix. Workload Secret references already match
the operator's target names, so no custom name-reference configuration is needed.

Before deploying this cleanup, verify that production deployment tooling will
not prune or delete live operator-managed Secrets when their placeholders
disappear from rendered manifests. Keep the `ExternalSecret` resources, which
manage those Secrets. On a new deployment, workloads must wait until the
operator creates and populates their referenced Secrets.

The old `gitops/overlays/prod/` entry point has been removed; there is no
compatibility wrapper. Before consuming this revision, the deployment owner
must update the existing job/controller source path to `gitops/prod/` and
verify a no-op preview with unchanged ownership and prune behavior. Do not
create a second controller or recreate workloads. No live handoff has been
performed. Rollback uses the previous repository revision and source path.
