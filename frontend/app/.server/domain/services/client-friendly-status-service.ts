import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { ClientFriendlyStatusDto, ClientFriendlyStatusLocalizedDto } from '~/.server/domain/dtos';
import { ClientFriendlyStatusNotFoundException } from '~/.server/domain/exceptions';
import type { ClientFriendlyStatusDtoMapper } from '~/.server/domain/mappers';
import type { ClientFriendlyStatusRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing client friendly status data.
 */
export interface ClientFriendlyStatusService {
  /**
   * Retrieves a specific client friendly status by its ID.
   *
   * @param id - The ID of the client friendly status to retrieve.
   * @returns The ClientFriendlyStatus DTO corresponding to the specified ID.
   * @throws {ClientFriendlyStatusNotFoundException} If no client friendly status is found with the specified ID.
   */
  getClientFriendlyStatusById(id: string): Promise<ClientFriendlyStatusDto>;

  /**
   * Retrieves a specific client friendly status by its ID with localized names.
   *
   * @param id - The ID of the client friendly status to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The ClientFriendlyStatusLocalized DTO corresponding to the specified ID.
   * @throws {ClientFriendlyStatusNotFoundException} If no client friendly status is found with the specified ID.
   */
  getLocalizedClientFriendlyStatusById(id: string, locale: AppLocale): Promise<ClientFriendlyStatusLocalizedDto>;
}

export type ClientFriendlyStatusServiceImpl_ServerConfig = Pick<ServerConfig, 'LOOKUP_SVC_CLIENT_FRIENDLY_STATUS_CACHE_TTL_SECONDS'>;

/**
 * Implementation of the ClientFriendlyStatusService interface.
 * This service provides methods to manage and retrieve client friendly status data.
 *
 * The service uses caching to optimize performance and reduce redundant
 * database lookups. It integrates with a logging system to trace operations.
 */
@injectable()
export class DefaultClientFriendlyStatusService implements ClientFriendlyStatusService {
  private readonly log: Logger;
  private readonly clientFriendlyStatusDtoMapper: ClientFriendlyStatusDtoMapper;
  private readonly clientFriendlyStatusRepository: ClientFriendlyStatusRepository;
  private readonly serverConfig: ClientFriendlyStatusServiceImpl_ServerConfig;

  /**
   * Constructs a new DefaultClientFriendlyStatusService instance.
   *
   * @param logFactory - A factory for creating logger instances.
   * @param clientFriendlyStatusDtoMapper - The mapper responsible for transforming client friendly status entities into DTOs.
   * @param clientFriendlyStatusRepository - The repository for accessing client friendly status data.
   * @param serverConfig - The server configuration containing necessary constants and cache TTL values.
   */
  constructor(
    @inject(TYPES.ClientFriendlyStatusDtoMapper) clientFriendlyStatusDtoMapper: ClientFriendlyStatusDtoMapper,
    @inject(TYPES.ClientFriendlyStatusRepository) clientFriendlyStatusRepository: ClientFriendlyStatusRepository,
    @inject(TYPES.ServerConfig) serverConfig: ClientFriendlyStatusServiceImpl_ServerConfig,
  ) {
    this.log = createLogger('DefaultClientFriendlyStatusService');
    this.clientFriendlyStatusDtoMapper = clientFriendlyStatusDtoMapper;
    this.clientFriendlyStatusRepository = clientFriendlyStatusRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    // Configure caching for client friendly status operations
    const clientFriendlyStatusCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_CLIENT_FRIENDLY_STATUS_CACHE_TTL_SECONDS;

    this.log.debug('Cache TTL value: clientFriendlyStatusCacheTTL: %d ms', clientFriendlyStatusCacheTTL);

    this.getClientFriendlyStatusById = memoize(this.getClientFriendlyStatusById, {
      async: true,
      maxSize: Infinity,
      expires: clientFriendlyStatusCacheTTL,
    });

    type MemoizedGetClientFriendlyStatusById = Memoized<typeof this.getClientFriendlyStatusById, Options<typeof this.getClientFriendlyStatusById>>;
    (this.getClientFriendlyStatusById as MemoizedGetClientFriendlyStatusById).cache.on('add', () => this.log.info('Creating new getClientFriendlyStatusById memo'));

    this.log.debug('DefaultClientFriendlyStatusService initiated.');
  }

  async getClientFriendlyStatusById(id: string): Promise<ClientFriendlyStatusDto> {
    this.log.debug('Get client friendly status with id: [%s]', id);

    const clientFriendlyStatusEntity = await this.clientFriendlyStatusRepository.findClientFriendlyStatusById(id);

    if (clientFriendlyStatusEntity.isNone()) {
      this.log.error('Client friendly status with id: [%s] not found', id);
      throw new ClientFriendlyStatusNotFoundException(`Client friendly status with id: [${id}] not found`);
    }

    const clientFriendlyStatusDto = this.clientFriendlyStatusDtoMapper.mapClientFriendlyStatusEntityToClientFriendlyStatusDto(clientFriendlyStatusEntity.unwrap());
    this.log.trace('Returning client friendly status: [%j]', clientFriendlyStatusDto);
    return clientFriendlyStatusDto;
  }

  async getLocalizedClientFriendlyStatusById(id: string, locale: AppLocale): Promise<ClientFriendlyStatusLocalizedDto> {
    this.log.debug('Get localized client friendly status with id: [%s] and locale: [%s]', id, locale);
    const clientFriendlyStatusDto = await this.getClientFriendlyStatusById(id);
    const clientFriendlyStatusLocalizedDto = this.clientFriendlyStatusDtoMapper.mapClientFriendlyStatusDtoToClientFriendlyStatusLocalizedDto(clientFriendlyStatusDto, locale);
    this.log.trace('Returning localized client friendly status: [%j]', clientFriendlyStatusLocalizedDto);
    return clientFriendlyStatusLocalizedDto;
  }
}
