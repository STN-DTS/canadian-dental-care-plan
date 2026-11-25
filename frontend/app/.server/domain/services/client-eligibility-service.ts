import { inject, injectable } from 'inversify';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientEligibilityDto } from '~/.server/domain/dtos';
import type { ClientEligibilityDtoMapper } from '~/.server/domain/mappers';
import type { ClientEligibilityRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_TTL_MS } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';
import { createMemoized } from '~/.server/utils/memoize-utils';
import { secondsToMilliseconds } from '~/utils/units-utils';

/**
 * A service that provides access to client eligibility data.
 */
export interface ClientEligibilityService {
  /**
   * Lists client eligibilities by client numbers.
   *
   * @param clientNumbers - An array of client numbers to retrieve eligibility information for.
   * @returns A Promise that resolves to a readonly map of client eligibility dtos keyed by client number.
   */
  listClientEligibilitiesByClientNumbers(clientNumbers: ReadonlyArray<string>): Promise<ReadonlyMap<string, ClientEligibilityDto>>;
}

@injectable()
export class DefaultClientEligibilityService implements ClientEligibilityService {
  private readonly log: Logger;
  private readonly clientEligibilityDtoMapper: ClientEligibilityDtoMapper;
  private readonly clientEligibilityRepository: ClientEligibilityRepository;
  private readonly auditService: AuditService;
  private readonly serverConfig: Pick<ServerConfig, 'ELIGIBILITY_STATUS_CODE_ELIGIBLE' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_MAX_SIZE'>;

  constructor(
    @inject(TYPES.ClientEligibilityDtoMapper) clientEligibilityDtoMapper: ClientEligibilityDtoMapper,
    @inject(TYPES.ClientEligibilityRepository) clientEligibilityRepository: ClientEligibilityRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'ELIGIBILITY_STATUS_CODE_ELIGIBLE' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_MAX_SIZE'>,
  ) {
    this.log = createLogger('DefaultClientEligibilityService');
    this.clientEligibilityDtoMapper = clientEligibilityDtoMapper;
    this.clientEligibilityRepository = clientEligibilityRepository;
    this.auditService = auditService;
    this.serverConfig = serverConfig;

    this.init();
  }

  private init(): void {
    const clientEligibilityCacheTtl = secondsToMilliseconds(this.serverConfig.LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS);
    this.log.debug('Client eligibility cache configured', { [ATTR_CDCP_CACHE_TTL_MS]: clientEligibilityCacheTtl });

    // Only the fetch is cached; the public method audits every access, including cache hits.
    const memoizedFetchClientEligibilities = createMemoized(this.fetchClientEligibilities, {
      async: true,
      expiresMs: clientEligibilityCacheTtl,
      key: (clientNumbers) => [...new Set(clientNumbers)].toSorted(),
      maxSize: this.serverConfig.LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_MAX_SIZE,
    });
    memoizedFetchClientEligibilities.cache.on('add', () => {
      this.log.debug('Client eligibility cache entry created');
    });
    this.fetchClientEligibilities = memoizedFetchClientEligibilities;

    this.log.debug('DefaultClientEligibilityService initiated.');
  }

  @Traced()
  async listClientEligibilitiesByClientNumbers(clientNumbers: ReadonlyArray<string>): Promise<ReadonlyMap<string, ClientEligibilityDto>> {
    this.log.trace('Getting client eligibility');

    this.auditService.createAudit('client-eligibility.number.get');

    const clientEligibilities = await this.fetchClientEligibilities(clientNumbers);

    this.log.trace('Returning client eligibility');
    return clientEligibilities;
  }

  private async fetchClientEligibilities(clientNumbers: ReadonlyArray<string>): Promise<ReadonlyMap<string, ClientEligibilityDto>> {
    const clientEligibilityRequestDto = clientNumbers.map((clientNumber) => ({ clientNumber }));
    const clientEligibilityRequestEntity = this.clientEligibilityDtoMapper.mapClientEligibilityRequestDtoToClientEligibilityRequestEntity(clientEligibilityRequestDto);
    const clientEligibilityEntities = await this.clientEligibilityRepository.listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity);
    const clientEligibilityDtos = clientEligibilityEntities.map((entity) => this.clientEligibilityDtoMapper.mapClientEligibilityEntityToClientEligibilityDto(entity));
    return new Map(clientEligibilityDtos.map((dto) => [dto.clientNumber, dto]));
  }
}
