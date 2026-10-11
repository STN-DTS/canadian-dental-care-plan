# Monorepo Copilot Instructions

This repository contains three independently scoped areas:

- `frontend/`: React Router, React, TypeScript, and Express application code.
- `gitops/`: Kubernetes manifests and Kustomize overlays.
- `infrastructure/`: Terraform and Terragrunt configuration.

Apply rules according to the file path. Frontend Express naming conventions do
not apply to GitOps or infrastructure files. See the path-scoped frontend
instructions for Express-specific guidance.

## GitHub Actions Fork Protection

Forks inherit workflow files but normally lack our Vault credentials, repository
configuration, and access to internal runners. The prerequisite gate prevents
accidental CI consumption, failures caused by missing configuration, jobs queued
for unavailable runners, and attempts to publish images or send team notifications
from copied workflows. Centralizing this check makes the policy explicit and
keeps it consistent across jobs, including completion notifications.

This is an operational safeguard, not a security boundary: fork owners can edit
their workflow copies. Parent-repository approval policies separately control
external contributors' pull request runs; they do not disable workflows inside
forks. A fork pull request running in the parent repository is not blocked by
this gate.

When editing workflows in `.github/workflows/`:

- Keep a prerequisite `check-repository` job with
  `if: ${{ github.event.repository.fork != true }}` and `permissions: {}`.
- Every other job must directly list `check-repository` in `needs`, alongside
  its existing dependencies. Preserve event, ref, and change-detection filters.
- Jobs using `always()` must also require
  `needs.check-repository.result == 'success'` so they cannot bypass the gate.
- Verify that forks skip the gate and dependent jobs, and non-forks permit
  otherwise eligible jobs. The `!= true` guard also permits an absent fork flag.
- Check dependency graphs for cycles and completion jobs for skipped, failed,
  and cancelled gate outcomes.
- This checks the repository running the workflow, not a pull request's source
  repository. Keep fork protection separate from unrelated workflow changes.
