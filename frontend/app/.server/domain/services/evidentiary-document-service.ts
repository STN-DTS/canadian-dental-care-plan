import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { CreateEvidentiaryDocumentMetadataRequest, CreateEvidentiaryDocumentMetadataResponseDto, EvidentiaryDocumentDto, EvidentiaryDocumentLocalizedDto, ListEvidentiaryDocumentsRequest } from '~/.server/domain/dtos';
import type { EvidentiaryDocumentDtoMapper } from '~/.server/domain/mappers';
import type { EvidentiaryDocumentRepository } from '~/.server/domain/repositories';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

/**
 * A service that provides access to evidentiary document data.
 */
export interface EvidentiaryDocumentService {
  /**
   * Lists evidentiary documents based on the provided request object.
   *
   * @param listEvidentiaryDocumentsRequestDto The request object containing the client ID and userId for auditing.
   * @returns A promise that resolves to an array of evidentiary document DTOs.
   */
  listEvidentiaryDocuments(listEvidentiaryDocumentsRequestDto: ListEvidentiaryDocumentsRequest): Promise<ReadonlyArray<EvidentiaryDocumentDto>>;

  /**
   * Lists evidentiary documents in the specified locale based on the provided request object.
   *
   * @param listEvidentiaryDocumentsRequestDto The request object containing the client ID and userId for auditing.
   * @param locale The desired locale (e.g., 'en' or 'fr').
   * @returns A promise that resolves to an array of localized evidentiary document DTOs.
   */
  listLocalizedEvidentiaryDocuments(listEvidentiaryDocumentsRequestDto: ListEvidentiaryDocumentsRequest, locale: AppLocale): Promise<ReadonlyArray<EvidentiaryDocumentLocalizedDto>>;

  /**
   * Uploads evidentiary document metadata.
   *
   * @param createEvidentiaryDocumentMetadataRequest The request object containing the documents to upload.
   * @returns A promise that resolves to the upload response DTO.
   */
  createEvidentiaryDocumentMetadata(createEvidentiaryDocumentMetadataRequest: CreateEvidentiaryDocumentMetadataRequest): Promise<CreateEvidentiaryDocumentMetadataResponseDto>;
}

@injectable()
export class DefaultEvidentiaryDocumentService implements EvidentiaryDocumentService {
  private readonly evidentiaryDocumentRepository;
  private readonly evidentiaryDocumentDtoMapper;
  private readonly log: Logger;

  constructor(@inject(TYPES.EvidentiaryDocumentRepository) evidentiaryDocumentRepository: EvidentiaryDocumentRepository, @inject(TYPES.EvidentiaryDocumentDtoMapper) evidentiaryDocumentDtoMapper: EvidentiaryDocumentDtoMapper) {
    this.log = createLogger('DefaultEvidentiaryDocumentService');
    this.evidentiaryDocumentRepository = evidentiaryDocumentRepository;
    this.evidentiaryDocumentDtoMapper = evidentiaryDocumentDtoMapper;
  }

  async listEvidentiaryDocuments(listEvidentiaryDocumentsRequest: ListEvidentiaryDocumentsRequest): Promise<ReadonlyArray<EvidentiaryDocumentDto>> {
    this.log.debug('Get all evidentiary documents for client: %s; userId: %s', listEvidentiaryDocumentsRequest.clientId, listEvidentiaryDocumentsRequest.userId);
    this.log.trace('Get all evidentiary documents for request [%j]', listEvidentiaryDocumentsRequest);

    const findEvidentiaryDocumentsRequest = listEvidentiaryDocumentsRequest;
    const evidentiaryDocumentEntities = await this.evidentiaryDocumentRepository.findEvidentiaryDocuments(findEvidentiaryDocumentsRequest);

    const evidentiaryDocumentDtos = this.evidentiaryDocumentDtoMapper.mapEvidentiaryDocumentEntitiesToEvidentiaryDocumentDtos(evidentiaryDocumentEntities);

    this.log.trace('Returning evidentiary documents: [%j]', evidentiaryDocumentDtos);
    return evidentiaryDocumentDtos;
  }

  async listLocalizedEvidentiaryDocuments(listEvidentiaryDocumentsRequest: ListEvidentiaryDocumentsRequest, locale: AppLocale): Promise<ReadonlyArray<EvidentiaryDocumentLocalizedDto>> {
    this.log.debug('Get all localized evidentiary documents for client: %s; userId: %s; locale: %s', listEvidentiaryDocumentsRequest.clientId, listEvidentiaryDocumentsRequest.userId, locale);

    const evidentiaryDocumentDtos = await this.listEvidentiaryDocuments(listEvidentiaryDocumentsRequest);
    const localizedEvidentiaryDocumentDtos = this.evidentiaryDocumentDtoMapper.mapEvidentiaryDocumentDtosToEvidentiaryDocumentLocalizedDtos(evidentiaryDocumentDtos, locale);

    this.log.trace('Returning localized evidentiary documents: [%j]', localizedEvidentiaryDocumentDtos);
    return localizedEvidentiaryDocumentDtos;
  }

  async createEvidentiaryDocumentMetadata(createEvidentiaryDocumentMetadataRequest: CreateEvidentiaryDocumentMetadataRequest): Promise<CreateEvidentiaryDocumentMetadataResponseDto> {
    this.log.debug('Upload evidentiary document metadata for client: %s; userId: %s', createEvidentiaryDocumentMetadataRequest.clientId, createEvidentiaryDocumentMetadataRequest.userId);
    this.log.trace('Upload evidentiary document metadata for request [%j]', createEvidentiaryDocumentMetadataRequest);

    const documentEntities = this.evidentiaryDocumentDtoMapper.mapCreateEvidentiaryDocumentMetadataDtosToEntities(createEvidentiaryDocumentMetadataRequest.documents);

    const repositoryRequest = {
      clientId: createEvidentiaryDocumentMetadataRequest.clientId,
      userId: createEvidentiaryDocumentMetadataRequest.userId,
      documents: documentEntities,
    };

    const uploadResponseEntity = await this.evidentiaryDocumentRepository.createEvidentiaryDocumentMetadata(repositoryRequest);

    const uploadResponseDto = this.evidentiaryDocumentDtoMapper.mapCreateEvidentiaryDocumentMetadataResponseEntityToDto(uploadResponseEntity);

    this.log.trace('Returning upload evidentiary document metadata response: [%j]', uploadResponseDto);
    return uploadResponseDto;
  }
}
