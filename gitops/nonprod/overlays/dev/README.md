[← Back to main README](../../README.md)

# Dev Overlay

Development environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-dev`                       |

## Base Components

- Frontend
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Adds OAuth proxy sidecar to the frontend deployment
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet replica count (3 pods: 1 primary + 2 replicas)

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/redis/replica.conf`, `configs/redis/sentinel.conf` — Redis HA configuration
- OAuth proxy Secret populated from Vault by External Secrets Operator
