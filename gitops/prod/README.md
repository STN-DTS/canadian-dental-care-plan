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

The old `gitops/overlays/prod/` entry point has been removed; there is no
compatibility wrapper. Before consuming this revision, the deployment owner
must update the existing job/controller source path to `gitops/prod/` and
verify a no-op preview with unchanged ownership and prune behavior. Do not
create a second controller or recreate workloads. No live handoff has been
performed. Rollback uses the previous repository revision and source path.
