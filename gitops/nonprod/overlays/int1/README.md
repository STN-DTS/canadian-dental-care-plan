[← Back to main README](../../README.md)

# Int1 Overlay

Integration environment 1 for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-int1`                      |

## Base Components

- Frontend
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Adds OAuth proxy sidecar to the frontend deployment
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet overrides

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/redis/replica.conf`, `configs/redis/sentinel.conf` — Redis HA configuration
- OAuth proxy secret created via `secretGenerator`
