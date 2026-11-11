import { Option } from 'effect';
import { inject, injectable } from 'inversify';
import { memoize } from 'micro-memoize';
import type { Memoized, Options } from 'micro-memoize';

import type { ServerConfig } from '~/.server/configs';
import { TYPES } from '~/.server/constants';
import type { DocumentUploadReasonDto, DocumentUploadReasonLocalizedDto } from '~/.server/domain/dtos';
import { DocumentUploadReasonNotFoundException } from '~/.server/domain/exceptions';
import type { DocumentUploadReasonDtoMapper } from '~/.server/domain/mappers';
import type { DocumentUploadReasonRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_ITEM_TTL_MS, ATTR_CDCP_CACHE_LIST_TTL_MS, ATTR_CDCP_LOCALE, ATTR_CDCP_REFERENCE_COUNT } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

/**
 * Service interface for managing document upload reason data.
 */
export interface DocumentUploadReasonService {
  /**
   * Retrieves a list of all document upload reasons.
   *
   * @returns An array of document upload reason DTOs.
   */
  listDocumentUploadReasons(): Promise<ReadonlyArray<DocumentUploadReasonDto>>;

  /**
   * Retrieves a specific document upload reason by its ID.
   *
   * @param id - The ID of the document upload reason to retrieve.
   * @returns The document upload reason DTO corresponding to the specified ID.
   * @throws {DocumentUploadReasonNotFoundException} If no document upload reason is found with the specified ID.
   */
  getDocumentUploadReasonById(id: string): Promise<DocumentUploadReasonDto>;

  /**
   * Retrieves a list of all document upload reasons in the specified locale.
   *
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns An array of document upload reason DTOs in the specified locale.
   */
  listLocalizedDocumentUploadReasons(locale: AppLocale): Promise<ReadonlyArray<DocumentUploadReasonLocalizedDto>>;

  /**
   * Retrieves a specific document upload reason by its ID in the specified locale.
   *
   * @param id - The ID of the document upload reason to retrieve.
   * @param locale - The desired locale (e.g., 'en' or 'fr').
   * @returns The document upload reason DTO corresponding to the specified ID in the given locale.
   * @throws {DocumentUploadReasonNotFoundException} If no document upload reason is found with the specified ID.
   */
  getLocalizedDocumentUploadReasonById(id: string, locale: AppLocale): Promise<DocumentUploadReasonLocalizedDto>;
}

@injectable()
export class DefaultDocumentUploadReasonService implements DocumentUploadReasonService {
  private readonly log: Logger;
  private readonly documentUploadReasonDtoMapper: DocumentUploadReasonDtoMapper;
  private readonly documentUploadReasonRepository: DocumentUploadReasonRepository;
  private readonly serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_DOCUMENT_UPLOAD_REASONS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_DOCUMENT_UPLOAD_REASON_CACHE_TTL_SECONDS'>;

  constructor(
    @inject(TYPES.DocumentUploadReasonDtoMapper) documentUploadReasonDtoMapper: DocumentUploadReasonDtoMapper,
    @inject(TYPES.DocumentUploadReasonRepository) documentUploadReasonRepository: DocumentUploadReasonRepository,
    @inject(TYPES.ServerConfig) serverConfig: Pick<ServerConfig, 'LOOKUP_SVC_ALL_DOCUMENT_UPLOAD_REASONS_CACHE_TTL_SECONDS' | 'LOOKUP_SVC_DOCUMENT_UPLOAD_REASON_CACHE_TTL_SECONDS'>,
  ) {
    this.log = createLogger('DefaultDocumentUploadReasonService');
    this.documentUploadReasonDtoMapper = documentUploadReasonDtoMapper;
    this.documentUploadReasonRepository = documentUploadReasonRepository;
    this.serverConfig = serverConfig;
    this.init();
  }

  private init(): void {
    // Configure caching for document upload reason operations
    const allDocumentUploadReasonsCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_ALL_DOCUMENT_UPLOAD_REASONS_CACHE_TTL_SECONDS;
    const documentUploadReasonCacheTTL = 1000 * this.serverConfig.LOOKUP_SVC_DOCUMENT_UPLOAD_REASON_CACHE_TTL_SECONDS;

    this.log.debug('Reference cache configured', { [ATTR_CDCP_CACHE_LIST_TTL_MS]: allDocumentUploadReasonsCacheTTL, [ATTR_CDCP_CACHE_ITEM_TTL_MS]: documentUploadReasonCacheTTL });

    this.listDocumentUploadReasons = memoize(this.listDocumentUploadReasons, {
      async: true,
      expires: allDocumentUploadReasonsCacheTTL,
    });

    type MemoizedListDocumentUploadReasons = Memoized<typeof this.listDocumentUploadReasons, Options<typeof this.listDocumentUploadReasons>>;
    (this.listDocumentUploadReasons as MemoizedListDocumentUploadReasons).cache.on('add', () => this.log.debug('Creating new listDocumentUploadReasons memo'));

    this.getDocumentUploadReasonById = memoize(this.getDocumentUploadReasonById, {
      async: true,
      maxSize: Infinity,
      expires: documentUploadReasonCacheTTL,
    });

    type MemoizedGetDocumentUploadReasonById = Memoized<typeof this.getDocumentUploadReasonById, Options<typeof this.getDocumentUploadReasonById>>;
    (this.getDocumentUploadReasonById as MemoizedGetDocumentUploadReasonById).cache.on('add', () => this.log.debug('Creating new getDocumentUploadReasonById memo'));

    this.log.debug('DefaultDocumentUploadReasonService initiated.');
  }

  @Traced()
  async listDocumentUploadReasons(): Promise<ReadonlyArray<DocumentUploadReasonDto>> {
    this.log.trace('Getting all document upload reasons');
    const documentUploadReasonEntities = await this.documentUploadReasonRepository.listAllDocumentUploadReasons();
    const documentUploadReasonDtos = this.documentUploadReasonDtoMapper.mapDocumentUploadReasonEntitiesToDocumentUploadReasonDtos(documentUploadReasonEntities);
    this.log.trace('Returning document upload reasons', { [ATTR_CDCP_REFERENCE_COUNT]: documentUploadReasonDtos.length });
    return documentUploadReasonDtos;
  }

  @Traced()
  async getDocumentUploadReasonById(id: string): Promise<DocumentUploadReasonDto> {
    this.log.trace('Getting document upload reason');

    const documentUploadReasonEntityOption = await this.documentUploadReasonRepository.findDocumentUploadReasonById(id);

    if (Option.isNone(documentUploadReasonEntityOption)) {
      throw new DocumentUploadReasonNotFoundException(`Document upload reason with id: [${id}] not found`);
    }

    const documentUploadReasonDto = this.documentUploadReasonDtoMapper.mapDocumentUploadReasonEntityToDocumentUploadReasonDto(Option.getOrThrow(documentUploadReasonEntityOption));
    this.log.trace('Returning document upload reason');
    return documentUploadReasonDto;
  }

  @Traced()
  async listLocalizedDocumentUploadReasons(locale: AppLocale): Promise<ReadonlyArray<DocumentUploadReasonLocalizedDto>> {
    this.log.trace('Getting all localized document upload reasons', { [ATTR_CDCP_LOCALE]: locale });
    const documentUploadReasonDtos = await this.listDocumentUploadReasons();
    const localizedDocumentUploadReasonDtos = this.documentUploadReasonDtoMapper.mapDocumentUploadReasonDtosToDocumentUploadReasonLocalizedDtos(documentUploadReasonDtos, locale);
    this.log.trace('Returning localized document upload reasons', { [ATTR_CDCP_LOCALE]: locale, [ATTR_CDCP_REFERENCE_COUNT]: localizedDocumentUploadReasonDtos.length });
    return localizedDocumentUploadReasonDtos;
  }

  @Traced()
  async getLocalizedDocumentUploadReasonById(id: string, locale: AppLocale): Promise<DocumentUploadReasonLocalizedDto> {
    this.log.trace('Getting localized document upload reason', { [ATTR_CDCP_LOCALE]: locale });
    const documentUploadReasonDto = await this.getDocumentUploadReasonById(id);
    const localizedDocumentUploadReasonDto = this.documentUploadReasonDtoMapper.mapDocumentUploadReasonDtoToDocumentUploadReasonLocalizedDto(documentUploadReasonDto, locale);
    this.log.trace('Returning localized document upload reason', { [ATTR_CDCP_LOCALE]: locale });
    return localizedDocumentUploadReasonDto;
  }
}
