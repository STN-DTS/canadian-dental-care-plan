import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { EvidentiaryDocumentTypeDto, EvidentiaryDocumentTypeLocalizedDto } from '~/.server/domain/dtos';
import { EvidentiaryDocumentTypeNotFoundException } from '~/.server/domain/exceptions';
import type { EvidentiaryDocumentTypeDtoMapper } from '~/.server/domain/mappers';
import type { EvidentiaryDocumentTypeRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * Service interface for managing evidentiary document type data.
 */
export interface EvidentiaryDocumentTypeService {
  /**
   * Retrieves a list of all evidentiary document types.
   *
   * @returns An array of evidentiary document type DTOs.
   */
  listEvidentiaryDocumentTypes(): Promise<ReadonlyArray<EvidentiaryDocumentTypeDto>>;

  /**
   * Retrieves a specific evidentiary document type by its ID.
   *
   * @param id - The ID of the evidentiary document type to retrieve.
   * @returns The evidentiary document type DTO corresponding to the specified ID.
   * @throws {EvidentiaryDocumentTypeNotFoundException} If no evidentiary document type is found with the specified ID.
   */
  getEvidentiaryDocumentTypeById(id: string): Promise<EvidentiaryDocumentTypeDto>;

  /**
   * Retrieves a list of all evidentiary document types in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of evidentiary document type DTOs in the specified locale.
   */
  listLocalizedEvidentiaryDocumentTypes(locale: AppLocale): Promise<ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto>>;

  /**
   * Retrieves a specific evidentiary document type by its ID in the specified locale.
   *
   * @param id - The ID of the evidentiary document type to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The evidentiary document type DTO corresponding to the specified ID in the given locale.
   * @throws {EvidentiaryDocumentTypeNotFoundException} If no evidentiary document type is found with the specified ID.
   */
  getLocalizedEvidentiaryDocumentTypeById(id: string, locale: AppLocale): Promise<EvidentiaryDocumentTypeLocalizedDto>;
}

@injectable()
export class DefaultEvidentiaryDocumentTypeService implements EvidentiaryDocumentTypeService {
  private readonly log: Logger;
  private readonly evidentiaryDocumentTypeDtoMapper: EvidentiaryDocumentTypeDtoMapper;
  private readonly evidentiaryDocumentTypeRepository: EvidentiaryDocumentTypeRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_EVIDENTIARY_DOCUMENT_TYPES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.EvidentiaryDocumentTypeDtoMapper) evidentiaryDocumentTypeDtoMapper: EvidentiaryDocumentTypeDtoMapper,
    @inject(TYPES.EvidentiaryDocumentTypeRepository) evidentiaryDocumentTypeRepository: EvidentiaryDocumentTypeRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_EVIDENTIARY_DOCUMENT_TYPES_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultEvidentiaryDocumentTypeService');
    this.evidentiaryDocumentTypeDtoMapper = evidentiaryDocumentTypeDtoMapper;
    this.evidentiaryDocumentTypeRepository = evidentiaryDocumentTypeRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    // Configure caching for evidentiary document type operations
    const allEvidentiaryDocumentTypesCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_EVIDENTIARY_DOCUMENT_TYPES_CACHE_TTL_SECONDS;
    const evidentiaryDocumentTypeCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_EVIDENTIARY_DOCUMENT_TYPE_CACHE_TTL_SECONDS;

    this.log.debug('Cache TTL values; allEvidentiaryDocumentTypesCacheTTL: %d ms, evidentiaryDocumentTypeCacheTTL: %d ms', allEvidentiaryDocumentTypesCacheTTL, evidentiaryDocumentTypeCacheTTL);

    this.listEvidentiaryDocumentTypes = memoize(this.listEvidentiaryDocumentTypes, {
      async: true,
      expires: allEvidentiaryDocumentTypesCacheTTL,
    });

    type MemoizedListEvidentiaryDocumentTypes = Memoized<typeof this.listEvidentiaryDocumentTypes, Options<typeof this.listEvidentiaryDocumentTypes>>;
    (this.listEvidentiaryDocumentTypes as MemoizedListEvidentiaryDocumentTypes).cache.on('add', () => this.log.info('Creating new listEvidentiaryDocumentTypes memo'));

    this.getEvidentiaryDocumentTypeById = memoize(this.getEvidentiaryDocumentTypeById, {
      async: true,
      maxSize: Infinity,
      expires: evidentiaryDocumentTypeCacheTTL,
    });

    type MemoizedGetEvidentiaryDocumentTypeById = Memoized<typeof this.getEvidentiaryDocumentTypeById, Options<typeof this.getEvidentiaryDocumentTypeById>>;
    (this.getEvidentiaryDocumentTypeById as MemoizedGetEvidentiaryDocumentTypeById).cache.on('add', () => this.log.info('Creating new getEvidentiaryDocumentTypeById memo'));

    this.log.debug('DefaultEvidentiaryDocumentTypeService initiated.');
  }

  async listEvidentiaryDocumentTypes(): Promise<ReadonlyArray<EvidentiaryDocumentTypeDto>> {
    this.log.trace('Getting all evidentiary document types');
    const evidentiaryDocumentTypeEntities = await this.evidentiaryDocumentTypeRepository.listAllEvidentiaryDocumentTypes();
    const evidentiaryDocumentTypeDtos = this.evidentiaryDocumentTypeDtoMapper.mapEvidentiaryDocumentTypeEntitiesToEvidentiaryDocumentTypeDtos(evidentiaryDocumentTypeEntities);
    this.log.trace('Returning evidentiary document types: [%j]', evidentiaryDocumentTypeDtos);
    return evidentiaryDocumentTypeDtos;
  }

  async getEvidentiaryDocumentTypeById(id: string): Promise<EvidentiaryDocumentTypeDto> {
    this.log.trace('Getting evidentiary document type with id: [%s]', id);

    const evidentiaryDocumentTypeEntityOption = await this.evidentiaryDocumentTypeRepository.findEvidentiaryDocumentTypeById(id);

    if (evidentiaryDocumentTypeEntityOption.isNone()) {
      this.log.error('Evidentiary document type with id: [%s] not found', id);
      throw new EvidentiaryDocumentTypeNotFoundException(`Evidentiary document type with id: [${id}] not found`);
    }

    const evidentiaryDocumentTypeDto = this.evidentiaryDocumentTypeDtoMapper.mapEvidentiaryDocumentTypeEntityToEvidentiaryDocumentTypeDto(evidentiaryDocumentTypeEntityOption.unwrap());
    this.log.trace('Returning evidentiary document type: [%j]', evidentiaryDocumentTypeDto);
    return evidentiaryDocumentTypeDto;
  }

  async listLocalizedEvidentiaryDocumentTypes(locale: AppLocale): Promise<ReadonlyArray<EvidentiaryDocumentTypeLocalizedDto>> {
    this.log.trace('Getting all localized evidentiary document types with locale: [%s]', locale);
    const evidentiaryDocumentTypeDtos = await this.listEvidentiaryDocumentTypes();
    const localizedEvidentiaryDocumentTypeDtos = this.evidentiaryDocumentTypeDtoMapper.mapEvidentiaryDocumentTypeDtosToEvidentiaryDocumentTypeLocalizedDtos(evidentiaryDocumentTypeDtos, locale);
    this.log.trace('Returning localized evidentiary document types: [%j]', localizedEvidentiaryDocumentTypeDtos);
    return localizedEvidentiaryDocumentTypeDtos;
  }

  async getLocalizedEvidentiaryDocumentTypeById(id: string, locale: AppLocale): Promise<EvidentiaryDocumentTypeLocalizedDto> {
    this.log.trace('Getting localized evidentiary document type with id: [%s] and locale: [%s]', id, locale);
    const evidentiaryDocumentTypeDto = await this.getEvidentiaryDocumentTypeById(id);
    const localizedEvidentiaryDocumentTypeDto = this.evidentiaryDocumentTypeDtoMapper.mapEvidentiaryDocumentTypeDtoToEvidentiaryDocumentTypeLocalizedDto(evidentiaryDocumentTypeDto, locale);
    this.log.trace('Returning localized evidentiary document type: [%j]', localizedEvidentiaryDocumentTypeDto);
    return localizedEvidentiaryDocumentTypeDto;
  }
}
