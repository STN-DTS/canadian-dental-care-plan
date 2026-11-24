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
      Older images do not recognize `AUTH_PROVIDER` and require the RAOIDC
      settings this overlay omits, so they fail to start.
- [ ] Replace the placeholder issuer, client ID and signing key ID with the
      approved iSAMS Test registration. Confirm the client assertion audience
      (`token-endpoint` or `issuer`). The placeholder issuer fails validation,
      so the frontend does not start until it is replaced.
- [ ] Vault contains `cdcp-dev` property `ISAMS_OIDC_PRIVATE_KEY`.
- [ ] DNS for the hostname exists, and `devdpdtsstncom` covers it.
- [ ] `https://cdcp-isams.dev-dp.dts-stn.com/auth/callback/oidc` is registered
      with iSAMS as the redirect URI, and
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
tracked in 8843: `/auth/login/oidc` starts the flow, and the callback returns
`{"outcome":"connectivity-verified","authenticated":false,...}`. It does not
sign the user in, so protected pages stay unavailable.
