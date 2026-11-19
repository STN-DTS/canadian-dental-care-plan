import { inject, injectable } from 'inversify';

import type { AppIdentityTokenCacheConfigEnv } from '~/.server/auth/app-identity-token-cache-config-schema';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants/types-constant';

type AppIdentityTokenCacheConfig_ServerConfig = Pick<ServerConfig, keyof AppIdentityTokenCacheConfigEnv>;

/**
 * Tunables for the app identity token cache, read from the validated server config.
 */
@injectable()
export class AppIdentityTokenCacheConfig {
  constructor(@inject(TYPES.ServerConfig) serverConfig: AppIdentityTokenCacheConfig_ServerConfig) {
    this.capacity = serverConfig.APP_IDENTITY_TOKEN_CACHE_CAPACITY;
    this.failureTtlMs = serverConfig.APP_IDENTITY_TOKEN_CACHE_FAILURE_TTL_MS;
    this.refreshMarginRatio = serverConfig.APP_IDENTITY_TOKEN_CACHE_REFRESH_MARGIN_RATIO;
    this.maxRefreshMarginMs = serverConfig.APP_IDENTITY_TOKEN_CACHE_MAX_REFRESH_MARGIN_MS;
  }

  /** Maximum number of identities retained by each cache; the least recently used entries are evicted beyond this. */
  readonly capacity: number;

  /** How long a failed acquisition is remembered, so an issuer outage is not hit by every caller. */
  readonly failureTtlMs: number;

  /** Fraction of a token's lifetime before its expiry at which a refresh starts (capped by {@link maxRefreshMarginMs}). */
  readonly refreshMarginRatio: number;

  /** Upper bound on how long before expiry a refresh starts. */
  readonly maxRefreshMarginMs: number;
}
