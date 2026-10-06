[← Back to main README](../../README.md)

# Prod Overlay

Production environment for the Canadian Dental Care Plan.

| Property       | Value                               |
| -------------- | ----------------------------------- |
| Cluster        | `dts-prod-sced-rhp-spoke-aks`       |
| Tier           | prod                                |
| Name suffix    | _(none)_                            |
| Image registry | `dtsrhpprodscedspokeacr.azurecr.io` |

## Base Components

- Error Pages (404)
- Frontend
- Fluentd Archiver
- Maintenance
- Redis
- Reloader

## Additional Resources

- External secrets (HashiCorp Vault)
- Horizontal Pod Autoscaler (HPA) — Frontend scales from 2 to 64 replicas at 75% CPU
- Ingress (public and internal)

## Patches

- `patches/deployments-frontend.yaml` — Adds OAuth proxy and fluentd sidecars, pins production image versions
- `patches/deployments-error-404.yaml` — Error page deployment overrides
- `patches/deployments-maintenance.yaml` — Maintenance page deployment overrides
- `patches/pvcs.yaml` — Persistent volume claim overrides
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet overrides (3 replicas, pinned image versions)

## Configuration Overrides

- `configs/frontend/config.conf` — Production frontend settings
- `configs/frontend-fluentd/fluentd.conf` — Fluentd audit log forwarding rules
- `configs/redis/` — Redis configuration overrides
- OAuth proxy secret created via `secretGenerator`
- Maintenance ConfigMap with time window literals (`startTimeEn`, `startTimeFr`, `endTimeEn`, `endTimeFr`)

## Ingress

- **Public**: `srv024.service.canada.ca`
- **Internal**: `canada-dental-care-plan.prod-dp-internal.dts-stn.com`
- Normal production routing uses `ingresses.yaml`. Maintenance and error-page ingress manifests are inactive alternatives in `kustomization.yaml`.

### Apply-maintenance contingency

`ingresses-apply-maintenance.yaml` is a dormant contingency and must not be activated as part of routine deployment. On the public host, it routes `/{segment}/application`, `/{segment}/protected/application`, `/{segment}/demande`, and `/{segment}/protege/demande` paths, including nested paths, to the maintenance service. The first segment is intentionally unrestricted for this temporary contingency, so matching paths with unsupported language values (for example, `/es/application/...`) also display maintenance instead of reaching the application's language validation. On the internal host, the same paths continue through `frontend:oauth-proxy` for restricted employee access. All other paths continue to use the frontend.

Before activation, confirm the business scope, including whether renewals or saved/in-progress applications must remain accessible. To activate, comment out `./ingresses.yaml` and uncomment only `./ingresses-apply-maintenance.yaml` in `kustomization.yaml`; render and review the production overlay before deployment. To roll back, restore `./ingresses.yaml` and comment out the contingency manifest, then deploy the restored overlay.

## Notes

This is the only overlay targeting the production cluster and tier. All images use pinned version tags.
Secret rotation is handled automatically via Reloader annotations.
