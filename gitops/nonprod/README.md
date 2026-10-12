# Nonproduction GitOps

This tree is the independent source for dev, int1, int2, otto, perf, prototype,
shared, staging, training, uat1, and uat2. Its bases and overlays are complete
copies of the legacy sources so changes here cannot be Kustomize inputs to
production.

Render an environment with `kubectl kustomize ./overlays/{environment}`.
Make nonprod changes only in this tree; do not auto-synchronize them into
production.

The legacy `gitops/base/` and `gitops/overlays/` directories have been removed.
No live source-path cutover has been performed. Before consuming this revision,
the deployment owner must change each source path to
`gitops/nonprod/overlays/{environment}` and verify a no-op deployment preview.
Rollback uses the previous repository revision and its previous source path,
not a second manifest tree in the current revision.
