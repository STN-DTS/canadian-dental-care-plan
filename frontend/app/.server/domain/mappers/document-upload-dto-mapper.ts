import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestDto, DocumentUploadErrorDto, DocumentUploadRequestDto } from '~/.server/domain/dtos';
import type { DocumentScanRequestEntity, DocumentUploadErrorEntity, DocumentUploadRequestEntity } from '~/.server/domain/entities';
import type { EvidentiaryDocumentTypeService } from '~/.server/domain/services';

export interface DocumentUploadDtoMapper {
  mapDocumentScanRequestDtoToEntity(documentScanRequestDto: DocumentScanRequestDto): DocumentScanRequestEntity;
  mapDocumentUploadErrorEntityToDto(documentUploadErrorEntity: DocumentUploadErrorEntity): DocumentUploadErrorDto;
  mapDocumentUploadRequestDtoToEntity(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadRequestEntity>;
}

@injectable()
export class DefaultDocumentUploadDtoMapper implements DocumentUploadDtoMapper {
  private readonly evidentiaryDocumentTypeService;

  constructor(@inject(TYPES.EvidentiaryDocumentTypeService) evidentiaryDocumentTypeService: EvidentiaryDocumentTypeService) {
    this.evidentiaryDocumentTypeService = evidentiaryDocumentTypeService;
  }

  mapDocumentScanRequestDtoToEntity(documentScanRequestDto: DocumentScanRequestDto): DocumentScanRequestEntity {
    return {
      filename: documentScanRequestDto.fileName,
      binary: documentScanRequestDto.binary,
    };
  }

  mapDocumentUploadErrorEntityToDto(documentUploadErrorEntity: DocumentUploadErrorEntity): DocumentUploadErrorDto {
    return {
      errorCode: documentUploadErrorEntity.ErrorCode,
      errorMessage: documentUploadErrorEntity.ErrorMessage,
    };
  }

  async mapDocumentUploadRequestDtoToEntity(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadRequestEntity> {
    const evidentiaryDocumentType = await this.evidentiaryDocumentTypeService.getEvidentiaryDocumentTypeById(documentUploadRequestDto.evidentiaryDocumentTypeId);
    return {
      filename: documentUploadRequestDto.fileName,
      binary: documentUploadRequestDto.binary,
      subjectPersonIdentificationID: documentUploadRequestDto.clientNumber,
      documentCategoryText: evidentiaryDocumentType.code,
      originalDocumentCreationDate: documentUploadRequestDto.uploadDate.toISOString(),
      transactionEntryUserID: documentUploadRequestDto.userId,
      originalDocumentLastModifiedDate: documentUploadRequestDto.lastModifiedDate.toISOString(),
      persist: true,
      commit: true,
    };
  }
}
