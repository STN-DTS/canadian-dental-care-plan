import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestDto, DocumentScanResponseDto, DocumentUploadRequestDto, DocumentUploadResponseDto } from '~/.server/domain/dtos';
import type { DocumentUploadDtoMapper } from '~/.server/domain/mappers';
import type { DocumentUploadRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';

export interface DocumentUploadService {
  /**
   * Upload a document to a predetermined drop location.
   * This will process the file through scan for threats and upload the file to an SFTP/FTPS drop location.
   * This does not save any metadata and is purely a drop location.
   *
   * @param documentUploadRequestDto The document upload request DTO
   * @returns A Promise that resolves to the document upload response DTO.
   */
  uploadDocument(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadResponseDto>;

  /**
   * Scan a document for threats and return scan result synchronously.
   *
   * @param documentScanRequestDto The document scan request DTO
   * @returns A Promise that resolves to the document scan response DTO.
   */
  scanDocument(documentScanRequestDto: DocumentScanRequestDto): Promise<DocumentScanResponseDto>;
}

@injectable()
export class DefaultDocumentUploadService implements DocumentUploadService {
  private readonly log: Logger;
  private readonly documentUploadDtoMapper: DocumentUploadDtoMapper;
  private readonly documentUploadRepository: DocumentUploadRepository;
  private readonly auditService: AuditService;

  constructor(@inject(TYPES.DocumentUploadDtoMapper) documentUploadDtoMapper: DocumentUploadDtoMapper, @inject(TYPES.DocumentUploadRepository) documentUploadRepository: DocumentUploadRepository, @inject(TYPES.AuditService) auditService: AuditService) {
    this.log = createLogger('DefaultDocumentUploadService');
    this.documentUploadDtoMapper = documentUploadDtoMapper;
    this.documentUploadRepository = documentUploadRepository;
    this.auditService = auditService;
    this.init();
  }

  private init(): void {
    this.log.debug('DefaultDocumentUploadService initiated.');
  }

  async uploadDocument(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadResponseDto> {
    this.log.trace('Uploading document with fileName [%s] for userId [%s]', documentUploadRequestDto.fileName, documentUploadRequestDto.userId);

    this.auditService.createAudit('documentupload.upload', { userId: documentUploadRequestDto.userId });

    const requestEntity = await this.documentUploadDtoMapper.mapDocumentUploadRequestDtoToEntity(documentUploadRequestDto);
    const responseEntity = await this.documentUploadRepository.uploadDocument(requestEntity);
    const responseDto = this.documentUploadDtoMapper.mapDocumentUploadResponseEntityToDto(responseEntity);

    this.log.trace('Returning document upload response [%j] for fileName [%s]', responseDto, documentUploadRequestDto.fileName);
    return responseDto;
  }

  async scanDocument(documentScanRequestDto: DocumentScanRequestDto): Promise<DocumentScanResponseDto> {
    this.log.trace('Scanning document with fileName [%s] for userId [%s]', documentScanRequestDto.fileName, documentScanRequestDto.userId);

    this.auditService.createAudit('documentupload.scan', { userId: documentScanRequestDto.userId });

    const requestEntity = this.documentUploadDtoMapper.mapDocumentScanRequestDtoToEntity(documentScanRequestDto);
    const responseEntity = await this.documentUploadRepository.scanDocument(requestEntity);
    const responseDto = this.documentUploadDtoMapper.mapDocumentScanResponseEntityToDto(responseEntity);

    this.log.trace('Returning document scan response [%j] for fileName [%s]', responseDto, documentScanRequestDto.fileName);
    return responseDto;
  }
}
