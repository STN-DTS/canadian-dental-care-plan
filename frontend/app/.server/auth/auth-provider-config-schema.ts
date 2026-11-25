import { Result } from 'effect';
import * as z from 'zod';

import { isPrivateKey } from '~/.server/utils/crypto-utils';
import { validateOAuthIssuer } from '~/.server/utils/url-utils';
import { stringToRedacted } from '~/.server/utils/zod-utils';

/** The only callback path the auth loader serves for AUTH_PROVIDER=oidc. */
export const OIDC_CALLBACK_PATHNAME = '/auth/callback/oidc';

/**
 * The redirect URI is sent at authorization and rebuilt from its origin and path at token exchange, so it must point at
 * the served callback path with no query, fragment or credentials. It must also be canonical (for example no explicit
 * default port or uppercase host), because URL parsing would otherwise send a different string than the registered one.
 */
function isValidOidcRedirectUri(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const url = new URL(value);
  return url.href === value && url.pathname === OIDC_CALLBACK_PATHNAME && url.search === '' && url.hash === '' && !value.includes('?') && !value.includes('#') && url.username === '' && url.password === '';
}

/** RS256 requires an RSA key; iSAMS accepts 2048- or 4096-bit keys. */
function isValidRs256PrivateKey(value: string): boolean {
  return isPrivateKey(value, { asymmetricKeyType: 'rsa', minModulusLength: 2048 });
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

  /** HTTPS issuer identifier; discovery uses `<issuer>/.well-known/openid-configuration`. */
  AUTH_OIDC_ISSUER_URL: z
    .string()
    .trim()
    .refine((val) => Result.isSuccess(validateOAuthIssuer(val)), { error: 'Invalid OIDC issuer URL' }),
  AUTH_OIDC_CLIENT_ID: z.string().trim().nonempty(),

  /** The exact redirect URI registered with the provider; sent unchanged at authorization and token exchange. */
  AUTH_OIDC_REDIRECT_URI: z.url({ protocol: /^https?$/ }).refine(isValidOidcRedirectUri, { error: `OIDC redirect URI must use the ${OIDC_CALLBACK_PATHNAME} path, in canonical form, with no query, fragment or credentials` }),

  /** RSA signing key registered for `private_key_jwt` (PEM or single-line base64 PKCS#8). */
  AUTH_OIDC_PRIVATE_KEY: z.string().refine(isValidRs256PrivateKey, { error: 'OIDC private key must be an RSA key of at least 2048 bits' }).pipe(stringToRedacted),

  /** Key identifier (`kid`) of the registered signing key, as configured with the provider. */
  AUTH_OIDC_PRIVATE_KEY_ID: z.string().trim().nonempty(),

  /** Client assertion `aud`: the discovered token endpoint, or the issuer identifier. Confirm against the registration. */
  AUTH_OIDC_CLIENT_ASSERTION_AUDIENCE: z.enum(['token-endpoint', 'issuer']).default('token-endpoint'),
});

export const authProviderConfigSchema = z.discriminatedUnion('AUTH_PROVIDER', [raoidcAuthProviderConfigSchema, oidcAuthProviderConfigSchema]);

export type AuthProviderConfig = z.infer<typeof authProviderConfigSchema>;

export type RaoidcAuthProviderConfig = Extract<AuthProviderConfig, { AUTH_PROVIDER: 'raoidc' }>;

export type OidcAuthProviderConfig = Extract<AuthProviderConfig, { AUTH_PROVIDER: 'oidc' }>;
