import { inject, injectable } from 'inversify';

import { TYPES } from '~/.server/constants';
import type { DocumentScanRequestDto, DocumentScanResponseDto, DocumentUploadErrorDto, DocumentUploadRequestDto, DocumentUploadResponseDto } from '~/.server/domain/dtos';
import type { DocumentScanRequestEntity, DocumentScanResponseEntity, DocumentUploadErrorEntity, DocumentUploadRequestEntity, DocumentUploadResponseEntity } from '~/.server/domain/entities';
import type { EvidentiaryDocumentTypeService } from '~/.server/domain/services';

export interface DocumentUploadDtoMapper {
  mapDocumentScanRequestDtoToEntity(documentScanRequestDto: DocumentScanRequestDto): DocumentScanRequestEntity;
  mapDocumentScanResponseEntityToDto(documentScanResponseEntity: DocumentScanResponseEntity): DocumentScanResponseDto;
  mapDocumentUploadErrorEntityToDto(documentUploadErrorEntity: DocumentUploadErrorEntity): DocumentUploadErrorDto;
  mapDocumentUploadRequestDtoToEntity(documentUploadRequestDto: DocumentUploadRequestDto): Promise<DocumentUploadRequestEntity>;
  mapDocumentUploadResponseEntityToDto(documentUploadResponseEntity: DocumentUploadResponseEntity): DocumentUploadResponseDto;
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

  mapDocumentScanResponseEntityToDto(documentScanResponseEntity: DocumentScanResponseEntity): DocumentScanResponseDto {
    return documentScanResponseEntity.DataId === null //
      ? { Error: this.mapDocumentUploadErrorEntityToDto(documentScanResponseEntity.Error) }
      : { DataId: documentScanResponseEntity.DataId };
  }

  mapDocumentUploadErrorEntityToDto(documentUploadErrorEntity: DocumentUploadErrorEntity): DocumentUploadErrorDto {
    return {
      ErrorCode: documentUploadErrorEntity.ErrorCode,
      ErrorMessage: documentUploadErrorEntity.ErrorMessage,
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
    };
  }

  mapDocumentUploadResponseEntityToDto(documentUploadResponseEntity: DocumentUploadResponseEntity): DocumentUploadResponseDto {
    return documentUploadResponseEntity.DocumentFileName === null //
      ? { Error: this.mapDocumentUploadErrorEntityToDto(documentUploadResponseEntity.Error) }
      : { DocumentFileName: documentUploadResponseEntity.DocumentFileName };
  }
}
