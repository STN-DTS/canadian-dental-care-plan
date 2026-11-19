import * as z from 'zod';

/**
 * Environment variables that tune the app identity token cache. All are optional; the defaults apply when unset.
 */
export const appIdentityTokenCacheConfigSchema = z.object({
  /** Maximum number of identities retained by each cache. */
  APP_IDENTITY_TOKEN_CACHE_CAPACITY: z.coerce.number().int().positive().default(100),

  /** How long a failed token request is remembered, in milliseconds. 0 disables it. */
  APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS: z.coerce.number().int().nonnegative().default(5_000),

  /** Fraction of a token's lifetime, before it expires, at which a background refresh starts. */
  APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO: z.coerce.number().gt(0).lt(1).default(0.1),

  /** Upper bound on how long before expiry a background refresh starts, in milliseconds. */
  APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS: z.coerce.number().int().nonnegative().default(300_000),
});

export type AppIdentityTokenCacheConfigEnv = z.infer<typeof appIdentityTokenCacheConfigSchema>;
