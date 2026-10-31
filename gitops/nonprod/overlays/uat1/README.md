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

## Configuration Overrides

- `configs/frontend/config.conf` — Environment-specific frontend settings
- `configs/redis/` — Redis configuration overrides
- `configs/maintenance/503.html` — Custom maintenance page content
- OAuth proxy secret created via `secretGenerator`

## Notes

Includes maintenance page support for testing downtime scenarios.

### Test the distroless audit volume

UAT1 selects frontend image `0.0.0-2d0f1116` for the distroless test.
The frontend mounts `audit-logs` at `/app/logs` to match the Dockerfile's
`WORKDIR /app`. UAT1 does not configure `fsGroup`. Verify that the mounted
volume is writable by the nonroot application after deployment.

From the repository root, render UAT1 without deploying it:

```sh
kubectl kustomize gitops/nonprod/overlays/uat1 >/dev/null
```

Run the local audit-volume check with Bash, Podman, and access to the
nonproduction image registry:

```sh
bash gitops/nonprod/overlays/uat1/tests/audit-volume.sh
```

The check uses the image's compiled application logger with synthetic data.
It verifies the default nonroot user, `/app` working directory, audit-file
creation, and file access from another nonroot container through `/logs`.
The test preconfigures an isolated volume with group ownership and write
permissions. UAT1 does not configure those permissions through `fsGroup`,
so a passing test does not prove that its Kubernetes volume is writable.
It uses no application credentials, publishes no ports, disables networking
inside the containers, and removes the test volume when it exits.

To test a locally built image instead, set `AUDIT_TEST_IMAGE`:

```sh
AUDIT_TEST_IMAGE=localhost/canadian-dental-care-plan:latest bash gitops/nonprod/overlays/uat1/tests/audit-volume.sh
```

A local-image pass does not verify the registry image. The check exits with
a nonzero status on failure. Success prints two `PASS:` messages.

After an approved UAT1 deployment, trigger an audited action with test data.
Use an approved volume-reading helper to confirm that its entry appears in
`/app/logs` and check container logs for file-permission errors.
Distroless has no shell. Do not rely on shell commands in the frontend container.
UAT1 has no Fluentd sidecar or archiver, so this environment cannot verify
end-to-end archive delivery. Verify that separately in a logging-enabled
environment before promoting the image to production.

### Enabling maintenance mode

1. In `kustomization.yaml`, comment out `./ingresses.yaml`
2. Uncomment `./ingresses-maintenance.yaml`
3. For letters-only maintenance, uncomment `./ingresses-letters-maintenance.yaml` instead
