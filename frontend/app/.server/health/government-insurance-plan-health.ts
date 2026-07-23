import type { HealthCheck } from '@dts-stn/health-checks';
import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { GovernmentInsurancePlanRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

@injectable()
export class GovernmentInsurancePlanHealthCheck implements HealthCheck {
  private readonly log: Logger;
  private readonly serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL'>;
  private readonly governmentInsurancePlanRepository: GovernmentInsurancePlanRepository;
  readonly name: string;
  readonly metadata?: Record<string, string>;

  constructor(
    @inject(TYPES.ServerConfig)
    serverConfig: Pick<ServerConfig, 'HEALTH_CACHE_TTL'>,
    @inject(TYPES.GovernmentInsurancePlanRepository) governmentInsurancePlanRepository: GovernmentInsurancePlanRepository,
  ) {
    this.log = createLogger('GovernmentInsurancePlanHealthCheck');
    this.serverConfig = serverConfig;
    this.governmentInsurancePlanRepository = governmentInsurancePlanRepository;
    this.name = 'governmentInsurancePlan';
    this.metadata = this.governmentInsurancePlanRepository.getMetadata();

    this.init();
  }

  private init(): void {
    const healthCacheTTL = this.serverConfig.HEALTH_CACHE_TTL;
    this.log.debug('Initializing GovernmentInsurancePlanHealthCheck with cache TTL of %d ms.', healthCacheTTL);

    this.check = memoize(this.check, {
      async: true,
      expires: healthCacheTTL,
      // transformKey is required to effectively ignore the abort signal sent from @dts-stn/health-checks when caching
      transformKey: () => [''],
    });

    type MemoizedCheck = Memoized<typeof this.check, Options<typeof this.check>>;
    (this.check as MemoizedCheck).cache.on('add', () => this.log.info('Cached function for GovernmentInsurancePlanHealthCheck has been initialized.'));

    this.log.debug('GovernmentInsurancePlanHealthCheck initialization complete.');
  }

  async check(signal?: AbortSignal): Promise<void> {
    await this.governmentInsurancePlanRepository.checkHealth();
  }
}
