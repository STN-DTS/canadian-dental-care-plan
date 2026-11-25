import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';
import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_TTL_MS } from '~/.server/logging/log-attributes';
import { userLogAttributes } from '~/.server/logging/user-log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import type { MemoizedFunction } from '~/.server/utils/memoize-utils';
import type { DynatraceRumScriptDto } from '~/.server/web/dtos';
import type { DynatraceDtoMapper } from '~/.server/web/mappers';
import type { DynatraceRepository } from '~/.server/web/repositories';

export interface DynatraceService {
  /**
   * Retrieves the Dynatrace Real User Monitoring (RUM) script.
   *
   * Results, including `null` fallbacks, are cached per process until the configured TTL expires.
   *
   * @returns A promise that resolves to the Dynatrace RUM script DTO,
   * or `null` if no RUM script is found or an error occurs during the retrieval
   */
  findDynatraceRumScript(): Promise<DynatraceRumScriptDto | null>;
}

@injectable()
export class DefaultDynatraceService implements DynatraceService {
  private readonly log: Logger;
  private readonly dynatraceDtoMapper: DynatraceDtoMapper;
  private readonly dynatraceRepository: DynatraceRepository;
  private readonly serverConfig: Pick<ServerConfig, 'DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.DynatraceDtoMapper) dynatraceDtoMapper: DynatraceDtoMapper,
    @inject(TYPES.DynatraceRepository) dynatraceRepository: DynatraceRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultDynatraceService');
    this.dynatraceDtoMapper = dynatraceDtoMapper;
    this.dynatraceRepository = dynatraceRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    const dynatraceRumScriptUriCacheTTL = 1000 * this.serverConfig.DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS;

    this.log.debug('Initializing Dynatrace RUM script cache', { [ATTR_CDCP_CACHE_TTL_MS]: dynatraceRumScriptUriCacheTTL });

    this.findDynatraceRumScript = createMemoized(this.findDynatraceRumScript, { maxSize: 1, async: true, expiresMs: dynatraceRumScriptUriCacheTTL });

    type MemoizedFindDynatraceRumScript = MemoizedFunction<typeof this.findDynatraceRumScript>;
    (this.findDynatraceRumScript as MemoizedFindDynatraceRumScript).cache.on('add', () => this.log.info('Creating new findDynatraceRumScript memo'));

    this.log.debug('DefaultDynatraceService initiated.');
  }

  @Traced()
  async findDynatraceRumScript(): Promise<DynatraceRumScriptDto | null> {
    this.log.trace('Finding Dynatrace RUM script', userLogAttributes());

    try {
      const dynatraceRumScript = await this.dynatraceRepository.findDynatraceRumScript();

      if (!dynatraceRumScript) {
        this.log.info('No Dynatrace RUM script found; returning null.');
        return null;
      }

      const dynatraceRumScriptDto = this.dynatraceDtoMapper.mapDynatraceRumScriptToDynatraceRumScriptDto(dynatraceRumScript);
      this.log.info('Dynatrace RUM script mapped');
      return dynatraceRumScriptDto;
    } catch {
      this.log.warn('Could not retrieve Dynatrace RUM script; returning null', { [ATTR_ERROR_TYPE]: 'rum_script_retrieval_failed' });
      return null;
    }
  }
}
