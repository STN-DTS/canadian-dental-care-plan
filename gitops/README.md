# Canadian Dental Care Plan GitOps manifests

This directory contains the Kustomize manifests for the Canadian Dental Care Plan
Kubernetes clusters. Nonproduction and production use separate manifest trees.

All resources use the `canada-dental-care-plan` namespace. Nonproduction overlays
add an environment suffix, such as `-dev`. Production resource names have no suffix.

## Repository structure

```text
gitops/
├── nonprod/                # Nonproduction manifests
│   ├── base/               # Shared nonproduction components
│   └── overlays/           # Eleven nonproduction environments
└── prod/                   # Independent production manifests
  ├── kustomization.yaml
  ├── deployments.yaml    # Production workloads
  ├── services.yaml
  ├── stateful-sets.yaml
  ├── pvcs.yaml
  ├── service-accounts.yaml
  ├── roles.yaml
  ├── role-bindings.yaml
  ├── hpas.yaml
  ├── external-secrets.yaml
  ├── ingresses.yaml
  └── configs/            # Production-only generator inputs
```

See the [nonproduction guide](nonprod/README.md) or the
[production guide](prod/README.md) for environment-specific instructions.
The old `gitops/base/` and `gitops/overlays/` directories no longer exist.
The [migration plan](../.github/plans/gitops-nonprod-prod-split.md) describes the split.

## Environment features

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

## Configuration

The shared nonproduction overlay includes a
[self-hosted Renovate CronJob](nonprod/overlays/shared/renovate/README.md)
for dependency maintenance. It defaults to suspended, full dry-run mode for safe
deployment and activation. It is not deployed to production.

`ExternalSecret` resources fetch application secrets from HashiCorp Vault through
`vault-backend` every hour. External Secrets Operator creates the Kubernetes Secrets.
Nonproduction name-reference configuration adds the environment suffix to Secret
references. Production uses unsuffixed names.

Workloads with `secret.reloader.stakater.com/auto: 'true'` restart when their
referenced Secrets change.

Nonproduction overlays use strategic merge patches in `patches/` to add
oauth2-proxy and Fluentd sidecars and override images and resources.
Base components define ConfigMap generators. Overlays use `behavior: merge`
to override their values. Production defines workloads and ConfigMap generators
directly in `prod/`.

Nonproduction uses `dtsrhpdevscedacr.azurecr.io`. Production uses
`dtsrhpprodscedspokeacr.azurecr.io` with pinned image versions.

Production does not consume Kustomize inputs from `nonprod/`.
Do not synchronize nonproduction manifests into production.

## Requirements

Use these versions to match PR validation:

| Tool                                               | Version |
| -------------------------------------------------- | ------- |
| [Kubectl](https://kubernetes.io/docs/tasks/tools/) | 1.37.1  |
| Embedded [Kustomize](https://kustomize.io/)        | 5.8.1   |

The PR validation job installs this renderer and verifies its published checksum.

Install the [validation dependencies](../.github/scripts/gitops/requirements.txt),
then run the tests from the repository root:

```shell
python3 -m unittest discover -s .github/scripts/gitops/tests -v
```

The isolation guard rejects remote inputs, paths outside the permitted tree,
and missing inputs. It also rejects unsupported Kustomize fields, including
plugin generators, plugin transformers, and Helm inputs.

## Usage

### Preview rendered manifests

Run these commands from the repository root:

```shell
kubectl kustomize gitops/nonprod/overlays/{target-environment}
kubectl kustomize gitops/prod
```

Replace `{target-environment}` with an overlay directory name, such as `int1`.
Rendering checks local inputs. It does not verify cluster access or deployment.

### Apply manifests to a cluster

The [GitOps operator (nonprod) workflow](../.github/workflows/gitops-main-nonprod.yaml)
deploys nonproduction changes from `main`. Pushes select overlays based on the
changed files. Manual and reusable runs deploy shared resources and all discovered
nonproduction environments. They share one AKS cluster and namespace.
The workflow does not deploy `prod/` and rejects refs other than `main`.

The workflow replaces the paused TeamCity **Synchronize all environments** job.
TeamCity already uses `gitops/nonprod/overlays/`, so this handoff does not change
the manifest paths. Merging the workflow starts a full nonproduction deployment.
Before merging, check the runner's tools, target cluster, and deployment permissions.
Confirm that no TeamCity build is running. Keep TeamCity paused to avoid competing
deployments.

From the repository root, request a full nonprod deployment with:

```shell
gh workflow run gitops-main-nonprod.yaml --ref main
```

See the [workflow documentation](../.github/workflows/README.md#nonprod-gitops-deployment)
for selection rules, credentials, and runner requirements. CI does not generate
application-secret files.
Verify the first live GitHub deployment after the handoff.
To roll back, follow the [rollback instructions](nonprod/README.md#workflow-rollback)
and merge a revert into `main`.
