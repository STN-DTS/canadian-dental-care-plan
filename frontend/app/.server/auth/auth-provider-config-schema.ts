import { Result } from 'effect';
import { createPrivateKey } from 'node:crypto';
import type { KeyObject } from 'node:crypto';
import * as z from 'zod';

import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { stringToRedacted } from '~/.server/utils/zod-utils';

/**
 * Parses an RSA private key given either as PEM (with BEGIN/END lines) or as single-line base64 PKCS#8 DER, the
 * format used by `AUTH_JWT_PRIVATE_KEY`.
 *
 * @throws When the value is not a parseable private key.
 */
export function parseOidcPrivateKey(value: string): KeyObject {
  const trimmed = value.trim();

  if (trimmed.startsWith('-----BEGIN')) {
    return createPrivateKey(trimmed);
  }

  return createPrivateKey({ key: Buffer.from(trimmed, 'base64'), format: 'der', type: 'pkcs8' });
}

/** RS256 requires an RSA key; iSAMS accepts 2048- or 4096-bit keys. */
function isValidRs256PrivateKey(value: string): boolean {
  try {
    const key = parseOidcPrivateKey(value);
    return key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048;
  } catch {
    return false;
  }
}

const raoidcAuthProviderConfigSchema = z.object({
  AUTH_PROVIDER: z.literal('raoidc').default('raoidc'),
  AUTH_RAOIDC_BASE_URL: z.string().trim().nonempty(),
  AUTH_RAOIDC_CLIENT_ID: z.string().trim().nonempty(),
});

/**
 * iSAMS OIDC connectivity proof. Only the settings needed for an authorization-code + PKCE exchange with
 * `private_key_jwt` client authentication are accepted; endpoints come from the issuer's discovery document.
 */
const oidcAuthProviderConfigSchema = z.object({
  AUTH_PROVIDER: z.literal('oidc'),

  // RAOIDC routes are disabled for this provider, so its settings are not required.
  AUTH_RAOIDC_BASE_URL: z.string().trim().default(''),
  AUTH_RAOIDC_CLIENT_ID: z.string().trim().default(''),

  /** HTTPS issuer identifier; discovery uses `<issuer>/.well-known/openid-configuration`. */
  AUTH_OIDC_ISSUER_URL: z
    .string()
    .trim()
    .refine((val) => Result.isSuccess(validateOAuthIssuer(val)), { error: 'Invalid OIDC issuer URL' }),
  AUTH_OIDC_CLIENT_ID: z.string().trim().nonempty(),

  /** The exact redirect URI registered with the provider; sent unchanged at authorization and token exchange. */
  AUTH_OIDC_REDIRECT_URI: z.url({ protocol: /^https?$/ }),

  /** RSA signing key registered for `private_key_jwt` (PEM or single-line base64 PKCS#8). */
  AUTH_OIDC_PRIVATE_KEY: z.string().refine(isValidRs256PrivateKey, { error: 'OIDC private key must be an RSA key of at least 2048 bits' }).pipe(stringToRedacted),

  /** Key identifier (`kid`) of the registered signing key, as configured with the provider. */
  AUTH_OIDC_PRIVATE_KEY_ID: z.string().trim().nonempty(),

  /** Client assertion `aud`: the discovered token endpoint, or the issuer identifier. Confirm against the registration. */
  AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: z.enum(['token-endpoint', 'issuer']).default('token-endpoint'),
});

export const authProviderConfigSchema = z.discriminatedUnion('AUTH_PROVIDER', [raoidcAuthProviderConfigSchema, oidcAuthProviderConfigSchema]);

export type AuthProviderConfig = z.infer<typeof authProviderConfigSchema>;

export type OidcAuthProviderConfig = Extract<AuthProviderConfig, { AUTH_PROVIDER: 'oidc' }>;
