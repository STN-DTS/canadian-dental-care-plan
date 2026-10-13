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
