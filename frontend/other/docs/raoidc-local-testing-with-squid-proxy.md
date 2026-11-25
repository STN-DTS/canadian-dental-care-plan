# Testing RAOIDC locally through the cluster Squid proxy

Use this guide to sign in to a locally running CDCP frontend with the real
nonprod RAOIDC (ECAS) service instead of the mock `/oidc` endpoints.

The nonprod RAOIDC servers, such as `srv241-s2.sade.hrdc-drhc.gc.ca`, are only
reachable from the on-premises network. The AKS cluster can reach them, so you
can port-forward the Squid proxy that runs in the cluster and send your traffic
through it.

Two separate clients must use the proxy:

| Client                   | Traffic                                                                                 | Configure with             |
| ------------------------ | --------------------------------------------------------------------------------------- | -------------------------- |
| Your browser             | Front channel: the RAOIDC authorize redirect, ECAS sign-in pages, and logout redirects  | Browser proxy settings     |
| The local Node.js server | Backchannel: discovery, JWKS, token exchange, userinfo, and session validation requests | `HTTP_PROXY_URL` in `.env` |

If either one bypasses the proxy, sign-in fails. The browser cannot load the
ECAS pages, or the callback fails when the server exchanges the authorization
code.

See [Authentication](./Authentication.md) for the login flow itself.

## Prerequisites

- Access to the nonprod AKS cluster (`dts-dev-sced-rhp-spoke-aks`) with
  permission to port-forward in the `canada-dental-care-plan` namespace.
- A working local frontend setup (see the [frontend README](../../README.md)).
- An ECAS test account for the RAOIDC environment you are targeting.

The `kubectl` examples assume your current context points at the nonprod
cluster. If it does not, add `--context` or `--kubeconfig` to each command.

## The Squid proxy

The [shared nonprod overlay](../../../gitops/nonprod/overlays/shared/kustomization.yaml)
deploys the proxy from
[gitops/nonprod/base/squid-proxy](../../../gitops/nonprod/base/squid-proxy) and
adds the `-shared` name suffix:

| Resource   | Value                                               |
| ---------- | --------------------------------------------------- |
| Namespace  | `canada-dental-care-plan`                           |
| Deployment | `squid-proxy-shared` (one replica)                  |
| Service    | `squid-proxy-shared` (`ClusterIP`, port `3128/TCP`) |
| Image      | `docker.io/ubuntu/squid:6.6-24.04_edge`             |

Always connect through the `squid-proxy-shared` service, not a pod. Pod names
change on every rollout, while the service name stays fixed.

To check that the proxy is running:

```sh
kubectl --namespace canada-dental-care-plan get deployment,service squid-proxy-shared
```

The image uses the stock Ubuntu Squid configuration:

- It does not require authentication.
- It allows requests from `localhost` and private networks. Port-forwarded
  connections arrive from `127.0.0.1` inside the pod, so they are allowed.
- It allows HTTPS (`CONNECT`) tunnels only to port `443`.
- It denies requests to `localhost` destinations. Your local app at
  `http://localhost:3000` must therefore bypass the proxy (see
  [Configure your browser](#2-configure-your-browser)).

Squid tunnels HTTPS without decrypting it, so you do not need to trust an
extra CA certificate.

## 1. Start the port-forward

Forward a local port to the `squid-proxy-shared` service:

```sh
kubectl --namespace canada-dental-care-plan \
  port-forward service/squid-proxy-shared 3128:3128
```

`kubectl` picks a ready pod behind the service and forwards to that pod's
`3128` port. You do not need to look up the pod name. If the pod is replaced,
the forward stops. Run the same command again to connect to the new pod.

Leave this command running. The proxy is now available at
`http://localhost:3128`. To use another local port, change the first number
(for example `13128:3128`) and use that port in the steps below.

To confirm the proxy can reach RAOIDC, request the discovery document through
it:

```sh
curl --proxy http://localhost:3128 \
  https://srv241-s2.sade.hrdc-drhc.gc.ca/ecas-seca/raoidc_ii/v1/.well-known/openid-configuration
```

A JSON document with an `issuer` field means the proxy works. The first request
to a RAOIDC host can take more than 20 seconds; retry before you troubleshoot.

## 2. Configure your browser

The browser must send RAOIDC and ECAS traffic (`*.hrdc-drhc.gc.ca`) through the
proxy, and must still reach `localhost:3000` directly. Use a separate browser
profile so your normal browsing does not depend on the port-forward.

### Option A: Chromium-based browsers (Chrome, Edge)

Start a separate instance with its own profile and proxy:

```sh
google-chrome \
  --user-data-dir="$HOME/.cache/cdcp-raoidc-profile" \
  --proxy-server="http://localhost:3128" \
  http://localhost:3000
```

Chromium never sends `localhost` traffic to a proxy, so the app stays
reachable. Use `microsoft-edge` or `chromium` in place of `google-chrome` if
needed.

### Option B: Firefox

1. Create a profile for this testing (`firefox -P`), then start Firefox with it.
2. Open **Settings > General > Network Settings > Settings...**.
3. Select **Manual proxy configuration**.
4. Set **HTTP Proxy** to `localhost`, **Port** to `3128`, and select **Also use
   this proxy for HTTPS**.
5. Leave **No proxy for** empty. Firefox bypasses `localhost` by default.

### Option C: Proxy only government hosts (PAC file)

To send only RAOIDC and ECAS traffic through the proxy, save this proxy
auto-config (PAC) file, for example as `~/cdcp-raoidc.pac`:

```js
function FindProxyForURL(url, host) {
  if (dnsDomainIs(host, '.hrdc-drhc.gc.ca')) {
    return 'PROXY localhost:3128';
  }
  return 'DIRECT';
}
```

Then use it instead of a fixed proxy:

- Chromium: `--proxy-pac-url="file://$HOME/cdcp-raoidc.pac"`
- Firefox: **Automatic proxy configuration URL** set to
  `file:///home/<you>/cdcp-raoidc.pac`

## 3. Configure the application

Pointing the browser at the proxy is not enough. After ECAS redirects back to
`/auth/callback/raoidc`, the Node.js server calls RAOIDC directly, from the
server rather than from the browser. It fetches the discovery document and
JWKS, exchanges the authorization code at the token endpoint, and fetches
userinfo. It also validates the RAOIDC session on protected requests. These
requests fail unless the server also uses the proxy.

The server does not read the standard `HTTP_PROXY` or `HTTPS_PROXY`
environment variables. [`DefaultRaoidcService`](../../app/.server/auth/raoidc-service.ts)
routes all RAOIDC calls through an undici `ProxyAgent` when `HTTP_PROXY_URL` is
set.

Update `frontend/.env` with the values for the target RAOIDC environment. The
example below uses the nonprod `raoidc_ii` server that UAT1, UAT2, staging,
perf, and otto use. Copy the values from the matching
`gitops/nonprod/overlays/<env>/configs/frontend/config.conf`.

```sh
# Send server-side (backchannel) requests through the port-forwarded proxy
HTTP_PROXY_URL=http://localhost:3128
HTTP_PROXY_TLS_TIMEOUT=30000

# Real RAOIDC instead of the local mock (/oidc)
AUTH_RAOIDC_BASE_URL=https://srv241-s2.sade.hrdc-drhc.gc.ca/ecas-seca/raoidc_ii/v1
AUTH_RAOIDC_CLIENT_ID=CDCP
AUTH_LOGOUT_REDIRECT_URL=https://srv241-s2.sade.hrdc-drhc.gc.ca/ecas-seca/raoidc_ii/v1/logout?client_id={clientId}&shared_session_id={sharedSessionId}&ui_locales={uiLocales}
AUTH_RASCL_LOGOUT_URL=https://srv241-s2.sade.hrdc-drhc.gc.ca/ecas-seca/rascl_ii/Support/GlobalLogout.aspx

# Key pair registered with RAOIDC for client CDCP (see below)
AUTH_JWT_PRIVATE_KEY=<private key>
AUTH_JWT_PUBLIC_KEY=<public key>
```

### Keys

The token exchange authenticates CDCP with a client assertion signed by
`AUTH_JWT_PRIVATE_KEY`. RAOIDC encrypts the ID token and userinfo token for the
matching public key. The sample keys in `.env.example` are not registered with
RAOIDC. With them, the token exchange fails or the tokens cannot be decrypted.

Use the nonprod key pair. It is stored in Vault under `cdcp-dev`, properties
`AUTH_JWT_PRIVATE_KEY` and `AUTH_JWT_PUBLIC_KEY`. It is also synced into the
`frontend-<env>` Kubernetes secrets, for example:

```sh
kubectl --namespace canada-dental-care-plan \
  get secret frontend-uat1 -o jsonpath='{.data.AUTH_JWT_PRIVATE_KEY}' | base64 --decode
```

Keep these values in your local `frontend/.env` only. Never commit them or
paste them into tickets or chat.

### Redirect URI

The app builds the callback URL from the request origin. When you browse to
`http://localhost:3000`, it sends
`redirect_uri=http://localhost:3000/auth/callback/raoidc`. That URI is
registered for client `CDCP` on the nonprod `raoidc_ii` server. Browse to
`http://localhost:3000`, not `http://127.0.0.1:3000` or another port. RAOIDC
rejects an unregistered redirect URI with `Invalid redirect url`.

### Mocks and other integrations

- The `raoidc` entry in `ENABLED_MOCKS` only enables the local mock `/oidc`
  endpoints. Once `AUTH_RAOIDC_BASE_URL` points at the real server, the mock is
  unused. Remove `raoidc` from `ENABLED_MOCKS` so you do not mix the two setups.
- The example `ENABLED_MOCKS` includes `power-platform`. When this mock is
  enabled, applicant lookups use a fixed local dataset. For applicant-dependent
  protected flows, use an ECAS test account whose userinfo `sin` matches one of
  the [mock applicant fixtures](../../app/.server/domain/repositories/applicant-repository.ts).
- `HTTP_PROXY_URL` also applies to the other non-mocked interop integrations.
  Keep their mocks enabled unless you intend to call those services through
  the proxy as well.

Restart the dev server after you change `.env`.

## 4. Sign in

1. Confirm the port-forward is still running.
2. In the proxied browser, open `http://localhost:3000` and start a protected
   flow, or go directly to `http://localhost:3000/auth/login/raoidc`.
3. Sign in on the ECAS pages with your test account.
4. ECAS redirects you to `http://localhost:3000/auth/callback/raoidc`. The
   server completes the token exchange through the proxy and redirects you to
   the protected page. This confirms the RAOIDC callback succeeded, not that
   applicant data is available. Protected applicant flows also require a
   `sin` claim in userinfo and an applicant record for that SIN. If the claim is
   missing, the protected flow redirects back to login. With the
   `power-platform` mock enabled, a SIN with no matching local fixture redirects
   to the data-unavailable page. These are downstream claim or fixture
   mismatches, not proxy or token-exchange failures.

Set `LOG_LEVEL=debug` to see the `Using proxy fetch` message from the HTTP
client and each RAOIDC step in the server logs.

## Troubleshooting

| Symptom                                                                 | Likely cause and fix                                                                                                                                                  |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser cannot load `srv*.sade.hrdc-drhc.gc.ca`                         | The browser is not using the proxy, or the port-forward stopped. Check the browser proxy settings and restart `kubectl port-forward`.                                 |
| `localhost:3000` fails only in the proxied browser                      | `localhost` is going through the proxy, and Squid denies it. Remove `localhost` from any custom proxy rules, or use the PAC file.                                     |
| `AUTH_OIDC_SERVER_METADATA_FETCH_FAILED`, or the login redirect hangs   | The server cannot reach RAOIDC. Check `HTTP_PROXY_URL`, restart the dev server, and test with the `curl` command in step 1.                                           |
| `AUTH_OIDC_ACCESS_TOKEN_FETCH_FAILED` on the callback                   | The token exchange was rejected. Check that `AUTH_JWT_PRIVATE_KEY` is the registered nonprod key and that `AUTH_RAOIDC_BASE_URL` matches the server you signed in to. |
| Token decryption fails after the callback                               | Confirm `AUTH_JWT_PRIVATE_KEY` matches the private key whose public key is registered for client `CDCP` on the same nonprod RAOIDC server.                            |
| JWT verification fails after successful decryption                      | After decryption, JWT verification uses RAOIDC's JWKS. Check the provider signing key/JWKS or token validity; the CDCP client key pair is not used.                   |
| Callback succeeds, then a protected flow returns to login               | The userinfo token may be missing the required `sin` claim. Confirm the ECAS test account provides it.                                                                |
| Callback succeeds, then a protected flow redirects to data unavailable  | With the `power-platform` mock enabled, the account's userinfo `sin` may not match a local applicant fixture. Use an account that matches a fixture.                  |
| `Invalid redirect url. client_id: CDCP` on the ECAS page                | The app is not running at `http://localhost:3000`. Use that exact origin.                                                                                             |
| `kubectl port-forward` exits with `lost connection to pod` or idles out | Port-forwards drop on idle timeouts and pod replacements. Run the `port-forward service/squid-proxy-shared` command again.                                            |
| `Forbidden` from `kubectl port-forward`                                 | Your account lacks `pods/portforward` permission in the namespace. Request nonprod cluster access.                                                                    |
