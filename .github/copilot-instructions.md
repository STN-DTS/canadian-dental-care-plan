# Monorepo Copilot Instructions

This repository contains three independently scoped areas:

- `frontend/`: React Router, React, TypeScript, and Express application code.
- `gitops/`: Kubernetes manifests and Kustomize overlays.
- `infrastructure/`: Terraform and Terragrunt configuration.

Apply rules according to the file path. Frontend Express naming conventions do
not apply to GitOps or infrastructure files. See the path-scoped frontend
instructions for Express-specific guidance.

## GitHub Actions Fork Protection Follow-Up

Fork protection is deferred to a separate PR after the Slack notification work.
When implementing that follow-up in `.github/workflows/`:

- Apply `github.event.repository.fork != true` to every job in all workflows.
- Combine the guard with existing conditions; preserve `always()` on completion
  notification jobs and existing event, ref, and change-detection filters.
- Use job-level `if`; GitHub Actions has no workflow-level `if`, and job-level
  conditions cannot read workflow `env`.
- Verify that `fork: true` skips jobs and `fork: false` permits otherwise eligible
  jobs. The requested `!= true` condition also permits an absent fork flag.
- This checks the repository running the workflow, not a pull request's source
  repository. Keep fork protection separate from unrelated workflow changes.
