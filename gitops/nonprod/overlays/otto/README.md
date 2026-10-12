[← Back to main README](../../README.md)

# Otto Overlay

Otto integration environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-otto`                      |

## Base Components

- Frontend
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Frontend deployment overrides
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet overrides

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/redis/` — Redis configuration overrides

## Notes

This environment does **not** include an OAuth proxy, making it focused on backend integration testing.
