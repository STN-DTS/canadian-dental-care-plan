[← Back to main README](../../README.md)

# Training Overlay

Training environment for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-training`                  |

## Base Components

- Frontend

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Frontend deployment overrides
- `patches/services.yaml` — Service customizations

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings

## Notes

Minimal environment for training purposes. Does not include Redis or OAuth proxy.
