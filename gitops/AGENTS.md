# GitOps Agent Guidance

These rules supplement the [root guidance](../AGENTS.md) for files under
`gitops/`. Read [README.md](README.md) and the affected environment documentation.

- Use Kubernetes and Kustomize conventions, not frontend naming rules.
- Keep nonproduction inputs under `nonprod/` and production inputs under
  `prod/`. Never synchronize nonprod configuration into production.
- Trace base resources, patches, generators, and overlay references before
  changing a shared input. Validate every affected consuming overlay.
- Preserve environment suffixes, namespaces, image references, resource names,
  and secret references unless the requested change explicitly alters them.
- Keep credentials out of manifests. Follow existing External Secrets
  patterns rather than embedding secret values.
- From the repository root, render an affected nonprod overlay with
  `kubectl kustomize gitops/nonprod/overlays/<environment>`. Render
  `gitops/prod` for production changes.
- Follow the validation tooling documented in the GitOps README. Rendering
  validates local inputs; it does not prove cluster permissions or deployment.
- Do not apply manifests, restart workloads, or change live cluster resources
  merely to validate a task.
