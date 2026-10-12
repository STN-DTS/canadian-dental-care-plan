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

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Adds OAuth proxy sidecar to the frontend deployment
- `patches/services.yaml` — Service customizations

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- OAuth proxy secret created via `secretGenerator`
