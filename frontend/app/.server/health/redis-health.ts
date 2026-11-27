import type { HealthCheck } from '@dts-stn/health-checks';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { RedisService } from '~/.server/data/redis-service';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_TTL_MS } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';

@injectable()
export class RedisHealthCheck implements HealthCheck {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL' | 'REDIS_USERNAME' | 'REDIS_STANDALONE_HOST' | 'REDIS_STANDALONE_PORT' | 'REDIS_SENTINEL_NAME' | 'REDIS_SENTINEL_HOST' | 'REDIS_SENTINEL_PORT' | 'REDIS_COMMAND_TIMEOUT_SECONDS'>;
  private readonly redisService: RedisService;
  readonly name: string;
  readonly metadata?: Record<string, string>;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL' | 'REDIS_USERNAME' | 'REDIS_STANDALONE_HOST' | 'REDIS_STANDALONE_PORT' | 'REDIS_SENTINEL_NAME' | 'REDIS_SENTINEL_HOST' | 'REDIS_SENTINEL_PORT' | 'REDIS_COMMAND_TIMEOUT_SECONDS'>,
    @inject(TYPES.RedisService) redisService: RedisService,
  ) {
    this.log = createLogger('RedisHealthCheck');
    this.serverConfig = serverConfig;
    this.redisService = redisService;
    this.name = 'redis';
    this.metadata = {
      REDIS_USERNAME: this.serverConfig.REDIS_USERNAME ?? '',
      REDIS_STANDALONE_HOST: this.serverConfig.REDIS_STANDALONE_HOST,
      REDIS_STANDALONE_PORT: this.serverConfig.REDIS_STANDALONE_PORT.toString(),
      REDIS_SENTINEL_NAME: this.serverConfig.REDIS_SENTINEL_NAME ?? '',
      REDIS_SENTINEL_HOST: this.serverConfig.REDIS_SENTINEL_HOST,
      REDIS_SENTINEL_PORT: this.serverConfig.REDIS_SENTINEL_PORT.toString(),
      REDIS_COMMAND_TIMEOUT_SECONDS: this.serverConfig.REDIS_COMMAND_TIMEOUT_SECONDS.toString(),
    };

    this.init();
  }

  private init(): void {
    const healthCacheTTL = this.serverConfig.HEALTH_CACHE_TTL;

    this.log.debug('Initializing Redis health check cache', { [ATTR_CDCP_CACHE_TTL_MS]: healthCacheTTL });

    this.check = createMemoized(this.check, {
      maxSize: 1,
      async: true,
      expiresMs: healthCacheTTL,
      // Ignore the abort signal sent from @dts-stn/health-checks so every check shares one cache entry
      key: () => '',
    });

    type MemoizedCheck = MemoizedFunction<typeof this.check>;
    (this.check as MemoizedCheck).cache.on('add', () => this.log.info('Initializing new cached Redis health check function'));

    this.log.debug('RedisHealthCheck initiated.');
  }

  @Traced()
  async check(signal?: AbortSignal): Promise<void> {
    await this.redisService.ping();
  }
}
