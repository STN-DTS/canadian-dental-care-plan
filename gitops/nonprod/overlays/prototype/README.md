[← Back to main README](../../README.md)

# Prototype Overlay

Prototype environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-prototype`                 |

## Base Components

- Frontend

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Frontend deployment overrides

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings

## Notes

Minimal environment for prototyping. Does not include Redis, OAuth proxy, or any supporting services.
