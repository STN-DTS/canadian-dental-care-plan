import { ATTR_ERROR_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';
import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestDto, DocumentScanResponseDto, DocumentUploadRequestDto, DocumentUploadResponseDto } from '~/.server/domain/dtos';
import type { DocumentUploadErrorEntity } from '~/.server/domain/entities';
import { DocumentUploadException } from '~/.server/domain/exceptions/document-upload-exception';
import type { DocumentUploadDtoMapper } from '~/.server/domain/mappers';
import type { DocumentUploadRepository } from '~/.server/domain/repositories';
import type { AuditService } from '~/.server/domain/services';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { ATTR_CDCP_DOCUMENT_OUTCOME, ATTR_CDCP_USER_ID } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

export interface DocumentUploadService {
  /**
   * Upload a document to a predetermined drop location.
   * This will process the file through scan for threats and upload the file to an SFTP/FTPS drop location.
   * This does not save any metadata and is purely a drop location.
   *
   * @param documentUploadRequestDto The document upload request DTO
   * @returns A success, unsafe-file, rejection, or technical error outcome. Technical failures are logged, not thrown.
   */
  uploadDocument(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadResponseDto>;

  /**
   * Scan a document for threats and return scan result synchronously.
   *
   * @param documentScanRequestDto The document scan request DTO
   * @returns A success, unsafe-file, rejection, or technical error outcome. Technical failures are logged, not thrown.
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

  @Traced()
  async uploadDocument(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadResponseDto> {
    this.log.trace('Uploading document', { [ATTR_CDCP_USER_ID]: documentUploadRequestDto.userId });

    try {
      this.auditService.createAudit('documentupload.upload', { userId: documentUploadRequestDto.userId });

      const requestEntity = await this.documentUploadDtoMapper.mapDocumentUploadRequestDtoToEntity(documentUploadRequestDto);
      const responseEntity = await this.documentUploadRepository.uploadDocument(requestEntity);

      if (responseEntity.DocumentFileName === null) {
        const status = this.getRejectionStatus(responseEntity.Error);
        this.log.warn('Document upload rejected', { [ATTR_CDCP_DOCUMENT_OUTCOME]: status });
        return { status, error: this.documentUploadDtoMapper.mapDocumentUploadErrorEntityToDto(responseEntity.Error) };
      }

      this.log.trace('Document uploaded successfully.');
      return { status: 'success', documentFileName: responseEntity.DocumentFileName };
    } catch (error) {
      if (error instanceof DocumentUploadException) {
        this.log.error('Technical document upload failure', {
          [ATTR_ERROR_TYPE]: `document_upload_${error.kind}`,
          [ATTR_HTTP_RESPONSE_STATUS_CODE]: error.httpStatus,
        });
      } else {
        this.log.error('Unexpected document upload error', { [ATTR_ERROR_TYPE]: 'document_upload_failed' });
      }

      return { status: 'error', error: error };
    }
  }

  @Traced()
  async scanDocument(documentScanRequestDto: DocumentScanRequestDto): Promise<DocumentScanResponseDto> {
    this.log.trace('Scanning document', { [ATTR_CDCP_USER_ID]: documentScanRequestDto.userId });

    try {
      this.auditService.createAudit('documentupload.scan', { userId: documentScanRequestDto.userId });

      const requestEntity = this.documentUploadDtoMapper.mapDocumentScanRequestDtoToEntity(documentScanRequestDto);
      const responseEntity = await this.documentUploadRepository.scanDocument(requestEntity);

      if (responseEntity.DataId === null) {
        const status = this.getRejectionStatus(responseEntity.Error);
        this.log.warn('Document scan rejected', { [ATTR_CDCP_DOCUMENT_OUTCOME]: status });
        return { status, Error: this.documentUploadDtoMapper.mapDocumentUploadErrorEntityToDto(responseEntity.Error) };
      }

      this.log.trace('Document scanned successfully.');
      return { status: 'success', DataId: responseEntity.DataId };
    } catch {
      this.log.error('Unexpected document scan error', { [ATTR_ERROR_TYPE]: 'document_scan_failed' });
      return { status: 'error' };
    }
  }

  private getRejectionStatus(error: DocumentUploadErrorEntity): 'unsafe' | 'rejected' {
    return error.ErrorCode === '400' && error.ErrorMessage === 'File not safe' ? 'unsafe' : 'rejected';
  }
}
