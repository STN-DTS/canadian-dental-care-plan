import { inject, injectable } from 'inversify';

import type { AppIdentityDiscoveryCacheConfigEnv } from '~/.server/auth/app-identity-discovery-cache-config-schema';
import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants/types-constant';

type AppIdentityDiscoveryCacheConfig_ServerConfig = Pick<ServerConfig, keyof AppIdentityDiscoveryCacheConfigEnv>;

/**
 * Tunables for the app identity OpenID discovery cache, read from the validated server config.
 */
@injectable()
export class AppIdentityDiscoveryCacheConfig {
  constructor(@inject(TYPES.ServerConfig) serverConfig: AppIdentityDiscoveryCacheConfig_ServerConfig) {
    this.capacity = serverConfig.APP_IDENTITY_DISCOVERY_CACHE_CAPACITY;
    this.ttlMs = serverConfig.APP_IDENTITY_DISCOVERY_CACHE_TTL_MS;
  }

  /** Maximum number of identities whose discovery metadata is retained; the least recently used entries are evicted beyond this. */
  readonly capacity: number;

  /** How long discovery metadata is reused, so endpoint changes are eventually picked up. */
  readonly ttlMs: number;
}
