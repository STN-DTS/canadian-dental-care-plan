[← Back to main README](../../README.md)

# Shared Overlay

Shared services deployed once for all non-production environments.

| Property    | Value                        |
| ----------- | ---------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks` |
| Tier        | nonprod                      |
| Name suffix | `-shared`                    |

## Components

- Maintenance
- Reloader
- Squid Proxy
- [Self-hosted Renovate](renovate/README.md) for dependency maintenance.

## Notes

This overlay provides shared infrastructure services that are not duplicated per environment.
It does not include any application workloads (frontend, redis, etc.) or environment-specific configuration.
