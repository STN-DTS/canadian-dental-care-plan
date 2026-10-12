# Container Image Signing

This action signs an immutable OCI image digest with Cosign and verifies it
against a repository public key. PROD and NONPROD use separate key pairs and
separate HashiCorp Vault instances.

## Current Configuration

All action inputs are required:

| Input                     | Purpose                                               |
| ------------------------- | ----------------------------------------------------- |
| `image-ref`               | Registry image reference ending in `@sha256:<digest>` |
| `vault-url`               | Environment-specific HashiCorp Vault URL              |
| `vault-approle-role-id`   | Vault AppRole RoleID                                  |
| `vault-approle-secret-id` | Vault AppRole SecretID, not an Azure SPN password     |
| `public-key-path`         | Matching public-key file in the repository            |

The workflows select these public keys:

- NONPROD: [nonprod-cosign-v1.pub](nonprod-cosign-v1.pub)
- PROD: [prod-cosign-v1.pub](prod-cosign-v1.pub)

The action currently reads the latest secret version from this fixed KV v2 API
path in the selected Vault instance:

```text
canada-dental-care-plan/data/shared/cicd/cosign
```

The secret contains `COSIGN_PRIVATE_KEY` (the complete encrypted PEM, including
headers and newlines) and `COSIGN_PASSWORD` (its decryption password). The AppRole
needs read access to this API path. Never store either value in Git, documentation,
chat, artifacts, or logs. Generate private keys outside the repository.

Example PROD invocation:

```yaml
- name: Sign and verify frontend OCI image
  uses: ./.github/actions/sign-container-image
  with:
    public-key-path: .github/actions/sign-container-image/prod-cosign-v1.pub
    image-ref: ${{ vars.PROD_ACR_DOMAIN }}/canada-dental-care-plan/canada-dental-care-plan-frontend@${{ steps.push. outputs.image-digest }}
    vault-url: ${{ secrets.PROD_VAULT_URL }}
    vault-approle-role-id: ${{ secrets.PROD_VAULT_APPROLE_ROLE_ID }}
    vault-approle-secret-id: ${{ secrets.PROD_VAULT_APPROLE_SECRET_ID }}
```

## Key Versioning

Public keys are safe to publish. Protect changes through review because they
define which signatures are trusted. Version keys by environment and key
generation, independently of application releases:

```text
nonprod-cosign-v1.pub
prod-cosign-v1.pub
prod-cosign-v2.pub
```

The current PROD and NONPROD public keys establish the `v1` versioned baseline;
their key material is unchanged by the filename versioning. `prod-cosign-v2.pub`
is an example of the next PROD rotation, not an existing file. Increment each
environment's generation independently when its key pair changes. These numbers
do not describe key changes that occurred before this naming convention.

Never replace a versioned public key with different key material. Keep old public
keys available for historical verification; old private keys are not needed to
verify existing signatures. Git history alone is not a verifier trust policy.

The `*.pub` rule in [CODEOWNERS](../../CODEOWNERS) covers current and future
generation files and assigns review to `@STN-DTS/cdcp-admins`. The team must have
explicit repository write access and be visible. Enable required code-owner
reviews on the target branch to enforce this ownership.

For each generation, record its environment, SHA-256 fingerprint of the public
key's DER SubjectPublicKeyInfo, activation date, retirement or revocation date,
matching Vault location, and status. Compute fingerprints consistently from the
decoded public key, not from PEM whitespace.

- **Active:** used for new signatures and trusted verification.
- **Retired:** no longer signs; historical verification may remain permitted.
- **Revoked:** must be rejected by consumer policy, even when mathematical
  signature verification succeeds.

## Rotation Procedure

1. Coordinate the change with image consumers and pause affected signing runs.
2. Generate a new environment-specific pair outside the repository. Keep the
   encrypted private key and password private.
3. Leave the previous versioned public-key file unchanged and add the new public
   key as the next generation, for example `prod-cosign-v2.pub`. Record their
   lifecycle metadata; do not rename `v1` to `v2` or overwrite `v1`.
4. Configure consumers to trust the new generation before publishing images
   signed with it. Preserve historical trust only where policy permits it.
5. Store the new encrypted private key and password together in the appropriate
   Vault. Prefer distinct secret paths such as `shared/cicd/cosign-v1` and
   `shared/cicd/cosign-v2` for generation-specific signing.
6. Update workflow preflight checks and `public-key-path` to the new public key.
   Ensure the action selects the matching private-key generation.
7. Test signing and verification on a controlled image digest, then resume runs.
8. Retire the old signing credential according to retention and incident policy.
   Do not retain access to a compromised private key merely to rebuild old tags.

**Current limitation:** the action has no configurable Cosign secret path or
secret-version input. Distinct Vault generation paths require that capability
before step 6 can select them. With today's fixed path, replacing the Vault pair
changes the key used by every run, including old workflow revisions. Those runs
can fail verification against their older checked-out public key. Coordinate the
Vault update and workflow change; do not assume old-tag rebuilds will still work.

Vault KV secret-version numbers and key-generation names are different concepts.
Adding `v1` to a public-key filename does not pin the Vault secret version or
change its path. A password-only change need not change the public key or key
generation.

## Historical Verification

Use the original image digest and a public key trusted by your verification
policy. No Vault login or private key is needed for this check; registry read
authentication may still be required.

From the repository root, in PowerShell:

```powershell
$image = "<registry>/<repository>@sha256:<64-character-digest>"
$publicKey = ".github/actions/sign-container-image/prod-cosign-v1.pub"
cosign verify --insecure-ignore-tlog --key $publicKey $image
```

Choose the retained generation-specific public key when verifying an older
signature. This command mirrors the action's current verification mode:
`--insecure-ignore-tlog` skips transparency-log verification. It verifies the
signature against the supplied key, but does not establish a trusted signing
time or enforce retirement/revocation rules. Consumers must enforce those rules
separately. Do not infer that a signature predates a compromise without trusted
timestamp or transparency evidence.
