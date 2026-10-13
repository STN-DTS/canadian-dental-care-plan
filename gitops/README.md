# Canadian Dental Care Plan GitOps Manifests

This repository contains the Kustomize configuration and application manifests used to manage both the production and
non-production Canadian Dental Care Plan Kubernetes clusters.

All resources deploy to the `canada-dental-care-plan` namespace. Nonproduction environments use a `nameSuffix`
(e.g., `-dev`); production preserves its existing unsuffixed resource names.

## Repository Structure

```text
gitops/
├── nonprod/                # Independent nonproduction source tree
│   ├── base/               # Nonproduction-only component definitions
│   └── overlays/           # Eleven nonproduction environments
└── prod/                   # Standalone production root
  ├── kustomization.yaml
  ├── deployments.yaml    # Effective production deployment definitions
  ├── services.yaml
  ├── stateful-sets.yaml
  ├── pvcs.yaml
  ├── service-accounts.yaml
  ├── roles.yaml
  ├── role-bindings.yaml
  ├── hpas.yaml
  ├── external-secrets.yaml
  ├── ingresses.yaml      # Active routing; alternatives are local files
  └── configs/            # Production-only generator inputs
```

Use [nonprod/README.md](nonprod/README.md) for nonproduction and [prod/README.md](prod/README.md) for production.
The old root-level `base/` and `overlays/` directories have been removed. Validation tooling and the
[migration plan](../.github/plans/gitops-nonprod-prod-split.md) live outside the manifest tree.

## Environment Feature Matrix

| Environment                                       | Tier | Frontend | Redis | OAuth Proxy | Fluentd Logging | HPA (Auto-scaling) | Error Pages (404) | Maintenance Page | Reloader | Squid Proxy |
| ------------------------------------------------- | ---- | -------- | ----- | ----------- | --------------- | ------------------ | ----------------- | ---------------- | -------- | ----------- |
| [Dev](nonprod/overlays/dev/README.md)             | np   | ✅       | ❌    | ✅          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [Int1](nonprod/overlays/int1/README.md)           | np   | ✅       | ✅    | ✅          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [Int2](nonprod/overlays/int2/README.md)           | np   | ✅       | ✅    | ✅          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [Otto](nonprod/overlays/otto/README.md)           | np   | ✅       | ✅    | ❌          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [Perf](nonprod/overlays/perf/README.md)           | np   | ✅       | ✅    | ✅          | ✅              | ✅                 | ❌                | ❌               | ❌       | ❌          |
| [Prod](prod/README.md)                            | prod | ✅       | ✅    | ✅          | ✅              | ✅                 | ✅                | ✅               | ✅       | ❌          |
| [Prototype](nonprod/overlays/prototype/README.md) | np   | ✅       | ❌    | ❌          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [Shared](nonprod/overlays/shared/README.md)       | np   | ❌       | ❌    | ❌          | ❌              | ❌                 | ❌                | ✅               | ✅       | ✅          |
| [Staging](nonprod/overlays/staging/README.md)     | np   | ✅       | ✅    | ✅          | ✅              | ✅                 | ✅                | ❌               | ❌       | ❌          |
| [Training](nonprod/overlays/training/README.md)   | np   | ✅       | ❌    | ❌          | ❌              | ❌                 | ❌                | ❌               | ❌       | ❌          |
| [UAT1](nonprod/overlays/uat1/README.md)           | np   | ✅       | ✅    | ✅          | ❌              | ❌                 | ❌                | ✅               | ❌       | ❌          |
| [UAT2](nonprod/overlays/uat2/README.md)           | np   | ✅       | ✅    | ✅          | ❌              | ❌                 | ❌                | ✅               | ❌       | ❌          |

> **np** = nonprod

## Key Patterns

- **External Secrets** — Environment roots use `ExternalSecret` resources to pull secrets from HashiCorp Vault
  (`secretStoreRef: vault-backend`), refreshing every hour.
- **Reloader** — Deployments annotated with `secret.reloader.stakater.com/auto: 'true'` automatically restart
  when their referenced secrets change.
- **Strategic Merge Patches** — Nonprod overlays inject sidecars (oauth2-proxy, fluentd) and override images/resources
  via patch files in `patches/`. Production contains the effective values directly.
- **ConfigMap/Secret Generators** — Nonprod base components define generators; overlays use `behavior: merge` or
  `behavior: replace` to override values per environment. Production defines its effective generators once.
- **Image Registries** — Nonprod uses `dtsrhpdevscedacr.azurecr.io`; prod uses `dtsrhpprodscedspokeacr.azurecr.io`
  with pinned image versions.

> Production is isolated in `prod/`; changes under `nonprod/` are not production Kustomize inputs. The earlier
> directory restructure is separate from the TeamCity-to-GitHub CI handoff: TeamCity already applies
> `gitops/nonprod/overlays/`. Local render checks do not verify live GitHub deployment. Never synchronize
> nonprod into production.

## Requirements

This project has been tested with the following toolchain:

| Tool                                               | Version |
| -------------------------------------------------- | ------- |
| [Kubectl](https://kubernetes.io/docs/tasks/tools/) | 1.37.1  |
| Embedded [Kustomize](https://kustomize.io/)        | 5.8.1   |

The PR validation job installs this pinned renderer and checks its published checksum. Verify the GitHub
deployment runner's tools, target settings, and permissions before merging the deployment workflow.

From the repository root, run `python3 -m unittest discover -s .github/scripts/gitops/tests -v` after installing
[validation requirements](../.github/scripts/gitops/requirements.txt). The isolation guard rejects remote/escaping or missing inputs and fails
closed for unsupported Kustomize fields, including plugin generators/transformers and Helm inputs.

## Usage

### Preview rendered manifests

```shell
kubectl kustomize ./nonprod/overlays/{target-environment}
kubectl kustomize ./prod
```

### Apply manifests to a cluster

The [GitOps operator (nonprod) workflow](../.github/workflows/gitops-main-nonprod.yaml)
applies Kustomizations when nonprod manifests change on `main`. Pushes select
overlays based on changed files. Manual and reusable runs apply shared resources
and all ten nonprod Kubernetes environments. These environments share one AKS
cluster and namespace. Every deployment run must use `main`.

This replaces the paused TeamCity **Synchronize all environments** job, which
already applies the same overlay paths. Merging the workflow intentionally
starts a full nonprod deployment. Before merging, confirm GitHub targets the
intended cluster and has deployment access, and verify no TeamCity build is
still running. Keep TeamCity paused to avoid competing deployments.

From the repository root, request a full nonprod deployment with:

```shell
gh workflow run gitops-main-nonprod.yaml --ref main
```

See the [workflow documentation](../.github/workflows/README.md#nonprod-gitops-deployment)
for target selection, credentials, and runner requirements. External Secrets
Operator supplies application secrets; CI does not generate secret files.
Verify the first live GitHub deployment after the CI handoff. This workflow does
not deploy `prod/`. See [workflow rollback](nonprod/README.md#workflow-rollback)
for recovery through a revert on `main`.

### Validate manifests without applying

```shell
kubectl kustomize ./nonprod/overlays/{target-environment} >/dev/null
kubectl kustomize ./prod >/dev/null
```
