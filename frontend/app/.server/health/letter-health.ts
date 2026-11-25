import type { HealthCheck } from '@dts-stn/health-checks';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { LetterRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_TTL_MS } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';

@injectable()
export class LetterHealthCheck implements HealthCheck {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL'>;
  private readonly letterRepository: LetterRepository;
  readonly name: string;
  readonly metadata?: Record<string, string>;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL'>,
    @inject(TYPES.LetterRepository) letterRepository: LetterRepository,
  ) {
    this.log = createLogger('LetterHealthCheck');
    this.serverConfig = serverConfig;
    this.letterRepository = letterRepository;
    this.name = 'letter';
    this.metadata = this.letterRepository.getMetadata();

    this.init();
  }

  private init(): void {
    const healthCacheTTL = this.serverConfig.HEALTH_CACHE_TTL;
    this.log.debug('Initializing LetterHealthCheck', { [ATTR_CDCP_CACHE_TTL_MS]: healthCacheTTL });

    this.check = createMemoized(this.check, {
      maxSize: 1,
      async: true,
      expiresMs: healthCacheTTL,
      // Ignore the abort signal sent from @dts-stn/health-checks so every check shares one cache entry
      key: () => '',
    });

    type MemoizedCheck = MemoizedFunction<typeof this.check>;
    (this.check as MemoizedCheck).cache.on('add', () => this.log.info('Cached function for LetterHealthCheck has been initialized.'));

    this.log.debug('LetterHealthCheck initialization complete.');
  }

  @Traced()
  async check(signal?: AbortSignal): Promise<void> {
    await this.letterRepository.checkHealth();
  }
}
