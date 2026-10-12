[← Back to main README](../../README.md)

# Staging Overlay

Staging (production-like) environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-staging`                   |

## Base Components

- Error Pages (404)
- Frontend
- Fluentd Archiver
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Horizontal Pod Autoscaler (HPA)
- Ingress

## Patches

- `patches/deployments.yaml` — Adds OAuth proxy and fluentd sidecars to the frontend deployment
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet overrides

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/frontend-fluentd/fluentd.conf` — Fluentd forwarding rules
- `configs/redis/` — Redis configuration overrides
- OAuth proxy secret created via `secretGenerator`

## Notes

The most production-like nonprod environment. Includes error pages, audit logging (fluentd), and auto-scaling (HPA).
A commented `ingresses-renew-error-404.yaml` resource is available to serve renewal-specific 404 pages.
