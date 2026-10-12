[← Back to main README](../../README.md)

# UAT2 Overlay

User acceptance testing environment 2 for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-uat2`                      |

## Base Components

- Frontend
- Maintenance
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress

## Patches

- `patches/deployments.yaml` — Adds OAuth proxy sidecar to the frontend deployment
- `patches/deployments-maintenance.yaml` — Maintenance page deployment overrides
- `patches/services.yaml` — Service customizations
- `patches/stateful-sets.yaml` — Redis StatefulSet overrides

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/redis/` — Redis configuration overrides
- OAuth proxy secret created via `secretGenerator`

## Notes

Includes maintenance page support for testing downtime scenarios.

### Enabling maintenance mode

1. In `kustomization.yaml`, comment out `./ingresses.yaml`
2. Uncomment `./ingresses-maintenance.yaml`
