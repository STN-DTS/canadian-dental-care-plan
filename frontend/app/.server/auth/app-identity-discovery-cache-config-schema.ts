import * as z from 'zod';

/**
 * Environment variables that tune the app identity OpenID discovery cache. All are optional; the defaults apply when unset.
 */
export const appIdentityDiscoveryCacheConfigSchema = z.object({
  /** Maximum number of identities whose OpenID discovery metadata is retained. */
  APP_IDENTITY_DISCOVERY_CACHE_CAPACITY: z.coerce.number().int().positive().default(100),

  /** How long OpenID discovery metadata is reused, in milliseconds, so endpoint changes are eventually picked up. */
  APP_IDENTITY_DISCOVERY_CACHE_TTL_MS: z.coerce.number().int().positive().default(3_600_000),
});

export type AppIdentityDiscoveryCacheConfigEnv = z.infer<typeof appIdentityDiscoveryCacheConfigSchema>;
