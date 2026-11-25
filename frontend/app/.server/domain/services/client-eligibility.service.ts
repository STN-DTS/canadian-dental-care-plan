import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientEligibilityDto } from '~/.server/domain/dtos';
import type { ClientEligibilityDtoMapper } from '~/.server/domain/mappers';
import type { ClientEligibilityRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { secondsToMilliseconds } from '~/utils/units.utils';

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
  private readonly serverConfig: Pick<ServerConfig, 'ELIGIBILITY_STATUS_CODE_ELIGIBLE' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.ClientEligibilityDtoMapper) clientEligibilityDtoMapper: ClientEligibilityDtoMapper,
    @inject(TYPES.ClientEligibilityRepository) clientEligibilityRepository: ClientEligibilityRepository,
    @inject(TYPES.AuditService) auditService: AuditService,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'ELIGIBILITY_STATUS_CODE_ELIGIBLE' | 'LOOKUP_SVC_CLIENT_ELIGIBILITY_CACHE_TTL_SECONDS'>,
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
    this.log.debug('Cache TTL value: %d ms', clientEligibilityCacheTtl);

    this.fetchClientEligibilities = memoize(this.fetchClientEligibilities, {
      async: true,
      expires: clientEligibilityCacheTtl,
      maxSize: 1000,
      transformKey: ([clientNumbers]) => [...new Set(clientNumbers)].toSorted(),
    });

    type MemoizedFetchClientEligibilities = Memoized<typeof this.fetchClientEligibilities, Options<typeof this.fetchClientEligibilities>>;
    (this.fetchClientEligibilities as MemoizedFetchClientEligibilities).cache.on('add', () => {
      this.log.info('Creating new fetchClientEligibilities memo');
    });

    this.log.debug('DefaultClientEligibilityService initiated.');
  }

  async listClientEligibilitiesByClientNumbers(clientNumbers: ReadonlyArray<string>): Promise<ReadonlyMap<string, ClientEligibilityDto>> {
    this.log.trace('Get client eligibility with numbers: [%j]', clientNumbers);

    this.auditService.createAudit('client-eligibility.number.get');

    const clientEligibilityDtos = await this.fetchClientEligibilities(clientNumbers);

    this.log.trace('Returning client eligibilities: [%j]', clientEligibilityDtos);
    return clientEligibilityDtos;
  }

  private async fetchClientEligibilities(clientNumbers: ReadonlyArray<string>): Promise<ReadonlyMap<string, ClientEligibilityDto>> {
    const clientEligibilityRequestDto = clientNumbers.map((clientNumber) => ({ clientNumber }));
    const clientEligibilityRequestEntity = this.clientEligibilityDtoMapper.mapClientEligibilityRequestDtoToClientEligibilityRequestEntity(clientEligibilityRequestDto);
    const clientEligibilityEntities = await this.clientEligibilityRepository.listClientEligibilitiesByClientNumbers(clientEligibilityRequestEntity);
    const clientEligibilityDtos = clientEligibilityEntities.map((entity) => this.clientEligibilityDtoMapper.mapClientEligibilityEntityToClientEligibilityDto(entity));

    return new Map(clientEligibilityDtos.map((dto) => [dto.clientNumber, dto]));
  }
}
