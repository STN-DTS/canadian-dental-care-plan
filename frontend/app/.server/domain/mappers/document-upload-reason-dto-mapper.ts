import { injectable } from 'inversify';

import type { DocumentUploadReasonDto, DocumentUploadReasonLocalizedDto } from '~/.server/domain/dtos';
import type { DocumentUploadReasonEntity } from '~/.server/domain/entities';

export interface DocumentUploadReasonDtoMapper {
  mapDocumentUploadReasonDtoToDocumentUploadReasonLocalizedDto(documentUploadReasonDto: DocumentUploadReasonDto, locale: AppLocale): DocumentUploadReasonLocalizedDto;
  mapDocumentUploadReasonDtosToDocumentUploadReasonLocalizedDtos(documentUploadReasonDtos: ReadonlyArray<DocumentUploadReasonDto>, locale: AppLocale): ReadonlyArray<DocumentUploadReasonLocalizedDto>;
  mapDocumentUploadReasonEntityToDocumentUploadReasonDto(documentUploadReasonEntity: DocumentUploadReasonEntity): DocumentUploadReasonDto;
  mapDocumentUploadReasonEntitiesToDocumentUploadReasonDtos(documentUploadReasonEntities: ReadonlyArray<DocumentUploadReasonEntity>): ReadonlyArray<DocumentUploadReasonDto>;
}

@injectable()
export class DefaultDocumentUploadReasonDtoMapper implements DocumentUploadReasonDtoMapper {
  mapDocumentUploadReasonDtoToDocumentUploadReasonLocalizedDto(documentUploadReasonDto: DocumentUploadReasonDto, locale: AppLocale): DocumentUploadReasonLocalizedDto {
    const { nameEn, nameFr, ...rest } = documentUploadReasonDto;
    return {
      ...rest,
      name: locale === 'fr' ? nameFr : nameEn,
    };
  }

  mapDocumentUploadReasonDtosToDocumentUploadReasonLocalizedDtos(documentUploadReasonDtos: ReadonlyArray<DocumentUploadReasonDto>, locale: AppLocale): ReadonlyArray<DocumentUploadReasonLocalizedDto> {
    return documentUploadReasonDtos.map((dto) => this.mapDocumentUploadReasonDtoToDocumentUploadReasonLocalizedDto(dto, locale));
  }

  mapDocumentUploadReasonEntityToDocumentUploadReasonDto(documentUploadReasonEntity: DocumentUploadReasonEntity): DocumentUploadReasonDto {
    const id = documentUploadReasonEntity.esdc_documentuploadreasonid;
    const nameEn = documentUploadReasonEntity.esdc_nameenglish;
    const nameFr = documentUploadReasonEntity.esdc_namefrench;
    return { id, nameEn, nameFr };
  }

  mapDocumentUploadReasonEntitiesToDocumentUploadReasonDtos(documentUploadReasonEntities: ReadonlyArray<DocumentUploadReasonEntity>): ReadonlyArray<DocumentUploadReasonDto> {
    return documentUploadReasonEntities.map((entity) => this.mapDocumentUploadReasonEntityToDocumentUploadReasonDto(entity));
  }
}
