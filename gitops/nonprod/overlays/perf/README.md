[← Back to main README](../../README.md)

# Perf Overlay

Performance testing environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-perf`                      |

## Base Components

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

This environment includes auto-scaling (HPA) and audit logging (fluentd) to simulate production-like load conditions.
