[← Back to main README](../../README.md)

# iSAMS Overlay

Nonproduction environment for the iSAMS OIDC **connectivity-only** proof.
It is based on [int1](../int1/README.md) and isolated from it by name suffix,
hostname, Redis instance, and session storage.

| Property    | Value                           |
| ----------- | ------------------------------- |
| Cluster     | `dts-dev-sced-rhp-spoke-aks`    |
| Tier        | nonprod                         |
| Name suffix | `-isams`                        |
| Hostname    | `cdcp-isams.dev-dp.dts-stn.com` |

> [!WARNING]
> This is a draft. The nonprod GitOps workflow deploys every overlay on merge
> to `main`. Do not merge until every item in [Before merging](#before-merging)
> is resolved and deployment is approved.

## Base Components

- Frontend
- Redis

## Additional Resources

- External secrets (HashiCorp Vault)
- Ingress. A single public host routes through the OAuth proxy. Unlike int1,
  there is no internal host that bypasses it.

## Patches

- `patches/deployments.yaml` — Adds the OAuth proxy sidecar and the frontend image
- `patches/services.yaml` — Service customizations

## Configuration Overrides

- `configs/frontend/config.conf` — `AUTH_PROVIDER=oidc`, iSAMS Test settings,
  and outbound access through `squid-proxy-shared`. The RAOIDC mock and
  `stub-login` are disabled.
- `configs/redis/replica.conf`, `configs/redis/sentinel.conf` — Redis HA configuration
- `configs/oauth-proxy/config.conf` — Entra ID gate. The cookie domain is
  limited to this host.
- Secrets populated from Vault by External Secrets Operator. The iSAMS signing
  key comes from `cdcp-dev` property `ISAMS_OIDC_PRIVATE_KEY`.

## Before merging

- [ ] The frontend image includes the 8840 OIDC PKCE flow. Pin its tag in
      `patches/deployments.yaml`; the build workflow restarts only dev and int1.
- [ ] The `AUTH_OIDC_*` variable and secret names match the 8840 schema. The
      current schema accepts only `AUTH_PROVIDER=mock` or `raoidc` and requires
      `AUTH_RAOIDC_BASE_URL` and `AUTH_RAOIDC_CLIENT_ID`, which this overlay omits.
- [ ] Replace the placeholder issuer and client ID with the approved iSAMS Test values.
- [ ] Vault contains `cdcp-dev` property `ISAMS_OIDC_PRIVATE_KEY`.
- [ ] DNS for the hostname exists, and `devdpdtsstncom` covers it.
- [ ] The callback URL is registered with iSAMS, and
      `https://cdcp-isams.dev-dp.dts-stn.com/oauth/callback` is registered on
      the OAuth proxy's Entra ID app.
- [ ] Squid allows outbound access to the iSAMS Test tenant.

## Follow-up

The connectivity proof does not call AccountMapper. Record the approved
outbound route to the INT1 AccountMapper API for 8841 here once it is identified.

## Verification

```shell
kubectl kustomize gitops/nonprod/overlays/isams
```

After approved deployment, check `/api/readyz` and confirm that the pod can
reach the iSAMS discovery document through the proxy. The live PKCE proof is
tracked in 8843.
