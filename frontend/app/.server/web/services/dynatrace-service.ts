import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import type { DynatraceRumScriptDto } from '~/.server/web/dtos';
import type { DynatraceDtoMapper } from '~/.server/web/mappers';
import type { DynatraceRepository } from '~/.server/web/repositories';

export interface DynatraceService {
  /**
   * Retrieves the Dynatrace Real User Monitoring (RUM) script.
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
  private readonly auditService: AuditService;
  private readonly serverConfig: Pick<ServerConfig, 'DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.DynatraceDtoMapper) dynatraceDtoMapper: DynatraceDtoMapper,
    @inject(TYPES.DynatraceRepository) dynatraceRepository: DynatraceRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultDynatraceService');
    this.dynatraceDtoMapper = dynatraceDtoMapper;
    this.dynatraceRepository = dynatraceRepository;
    this.auditService = auditService;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    const dynatraceRumScriptUriCacheTTL = 1000 * this.serverConfig.DYNATRACE_API_RUM_SCRIPT_URI_CACHE_TTL_SECONDS;

    this.log.debug('Cache TTL value: dynatraceRumScriptUriCacheTTL: %d ms', dynatraceRumScriptUriCacheTTL);

    this.findDynatraceRumScript = memoize(this.findDynatraceRumScript, { async: true });

    type MemoizedFindDynatraceRumScript = Memoized<typeof this.findDynatraceRumScript, Options<typeof this.findDynatraceRumScript>>;
    (this.findDynatraceRumScript as MemoizedFindDynatraceRumScript).cache.on('add', () => this.log.info('Creating new findDynatraceRumScript memo'));

    this.log.debug('DefaultDynatraceService initiated.');
  }

  async findDynatraceRumScript(userId = 'anonymous'): Promise<DynatraceRumScriptDto | null> {
    this.log.trace('Finding Dynatrace RUM script for user [%s]', userId);

    try {
      this.auditService.createAudit('dynatrace-service.retrieve-rum-script.get', { userId });

      const dynatraceRumScript = await this.dynatraceRepository.findDynatraceRumScript();
      if (!dynatraceRumScript) {
        this.log.debug('No Dynatrace RUM script found; returning null.');
        return null;
      }

      const dynatraceRumScriptDto = this.dynatraceDtoMapper.mapDynatraceRumScriptToDynatraceRumScriptDto(dynatraceRumScript);
      this.log.trace('Returning Dynatrace RUM script DTO: [%j]', dynatraceRumScriptDto);
      return dynatraceRumScriptDto;
    } catch (error) {
      this.log.warn('Unexpected server error while retrieving Dynatrace RUM Script; returning null; error: [%j]', error);
      return null;
    }
  }
}
