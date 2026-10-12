[← Back to main README](../../README.md)

# UAT1 Overlay

User acceptance testing environment 1 for the Canadian Dental Care Plan.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-uat1`                      |

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
- `configs/maintenance/503.html` — Custom maintenance page content
- OAuth proxy secret created via `secretGenerator`

## Notes

Includes maintenance page support for testing downtime scenarios.

### Enabling maintenance mode

1. In `kustomization.yaml`, comment out `./ingresses.yaml`
2. Uncomment `./ingresses-maintenance.yaml`
3. For letters-only maintenance, uncomment `./ingresses-letters-maintenance.yaml` instead
