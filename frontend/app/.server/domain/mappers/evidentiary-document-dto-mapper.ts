import { injectable } from 'inversify';

import type { CreateEvidentiaryDocumentMetadataDto, CreateEvidentiaryDocumentMetadataResponseDto, EvidentiaryDocumentDto, EvidentiaryDocumentLocalizedDto } from '~/.server/domain/dtos';
import type { CreateEvidentiaryDocumentMetadataResponseEntity, EvidentiaryDocumentEntity, UploadEvidentiaryDocumentMetadataEntity } from '~/.server/domain/entities';
import { Traced } from '~/.server/observability/decorator';

export interface EvidentiaryDocumentDtoMapper {
  mapEvidentiaryDocumentDtoToEvidentiaryDocumentLocalizedDto(evidentiaryDocumentDto: EvidentiaryDocumentDto, locale: AppLocale): EvidentiaryDocumentLocalizedDto;
  mapEvidentiaryDocumentDtosToEvidentiaryDocumentLocalizedDtos(evidentiaryDocumentDtos: ReadonlyArray<EvidentiaryDocumentDto>, locale: AppLocale): ReadonlyArray<EvidentiaryDocumentLocalizedDto>;
  mapEvidentiaryDocumentEntityToEvidentiaryDocumentDto(evidentiaryDocumentEntity: EvidentiaryDocumentEntity): EvidentiaryDocumentDto;
  mapEvidentiaryDocumentEntitiesToEvidentiaryDocumentDtos(evidentiaryDocumentEntities: ReadonlyArray<EvidentiaryDocumentEntity>): ReadonlyArray<EvidentiaryDocumentDto>;

  mapCreateEvidentiaryDocumentMetadataDtoToEntity(uploadDto: CreateEvidentiaryDocumentMetadataDto): UploadEvidentiaryDocumentMetadataEntity;
  mapCreateEvidentiaryDocumentMetadataDtosToEntities(uploadDtos: ReadonlyArray<CreateEvidentiaryDocumentMetadataDto>): ReadonlyArray<UploadEvidentiaryDocumentMetadataEntity>;
  mapCreateEvidentiaryDocumentMetadataResponseEntityToDto(responseEntity: CreateEvidentiaryDocumentMetadataResponseEntity): CreateEvidentiaryDocumentMetadataResponseDto;
}

@injectable()
export class DefaultEvidentiaryDocumentDtoMapper implements EvidentiaryDocumentDtoMapper {
  @Traced()
  mapEvidentiaryDocumentDtoToEvidentiaryDocumentLocalizedDto(evidentiaryDocumentDto: EvidentiaryDocumentDto, locale: AppLocale): EvidentiaryDocumentLocalizedDto {
    const { documentType, ...rest } = evidentiaryDocumentDto;
    return {
      ...rest,
      documentType: {
        id: documentType.id,
        name: locale === 'fr' ? documentType.nameFrench : documentType.nameEnglish,
      },
    };
  }

  @Traced()
  mapEvidentiaryDocumentDtosToEvidentiaryDocumentLocalizedDtos(evidentiaryDocumentDtos: ReadonlyArray<EvidentiaryDocumentDto>, locale: AppLocale): ReadonlyArray<EvidentiaryDocumentLocalizedDto> {
    return evidentiaryDocumentDtos.map((dto) => this.mapEvidentiaryDocumentDtoToEvidentiaryDocumentLocalizedDto(dto, locale));
  }

  @Traced()
  mapEvidentiaryDocumentEntityToEvidentiaryDocumentDto(evidentiaryDocumentEntity: EvidentiaryDocumentEntity): EvidentiaryDocumentDto {
    return {
      id: evidentiaryDocumentEntity.id,
      fileName: evidentiaryDocumentEntity.fileName,
      clientId: evidentiaryDocumentEntity.clientId,
      documentTypeId: evidentiaryDocumentEntity.documentTypeId,
      mscaUploadDate: evidentiaryDocumentEntity.mscaUploadDate,
      recordSource: evidentiaryDocumentEntity.recordSource,
      healthCanadaTransferDate: evidentiaryDocumentEntity.healthCanadaTransferDate,
      client: evidentiaryDocumentEntity.client,
      documentType: evidentiaryDocumentEntity.documentType,
    };
  }

  @Traced()
  mapEvidentiaryDocumentEntitiesToEvidentiaryDocumentDtos(evidentiaryDocumentEntities: ReadonlyArray<EvidentiaryDocumentEntity>): ReadonlyArray<EvidentiaryDocumentDto> {
    return evidentiaryDocumentEntities.map((entity) => this.mapEvidentiaryDocumentEntityToEvidentiaryDocumentDto(entity));
  }

  @Traced()
  mapCreateEvidentiaryDocumentMetadataDtoToEntity(uploadDto: CreateEvidentiaryDocumentMetadataDto): UploadEvidentiaryDocumentMetadataEntity {
    return {
      fileName: uploadDto.fileName,
      documentTypeId: uploadDto.evidentiaryDocumentTypeId,
      documentUploadReasonId: uploadDto.documentUploadReasonId,
      recordSource: uploadDto.recordSource,
      uploadDate: uploadDto.uploadDate.toString(),
      healthCanadaTransferDate: uploadDto.healthCanadaTransferDate,
    };
  }

  @Traced()
  mapCreateEvidentiaryDocumentMetadataDtosToEntities(uploadDtos: ReadonlyArray<CreateEvidentiaryDocumentMetadataDto>): ReadonlyArray<UploadEvidentiaryDocumentMetadataEntity> {
    return uploadDtos.map((dto) => this.mapCreateEvidentiaryDocumentMetadataDtoToEntity(dto));
  }

  @Traced()
  mapCreateEvidentiaryDocumentMetadataResponseEntityToDto(responseEntity: CreateEvidentiaryDocumentMetadataResponseEntity): CreateEvidentiaryDocumentMetadataResponseDto {
    return {
      evidentiaryDocuments: responseEntity.esdc_evidentiarydocuments.map((doc) => ({
        fileName: doc.esdc_filename,
        evidentiaryDocumentTypeId: doc['_esdc_documenttypeid_value'],
        documentUploadReasonId: doc['_esdc_documentuploadreasonid_value'],
        uploadDate: doc.esdc_uploaddate,
        healthCanadaTransferDate: doc.esdc_hctransferdate,
        clientId: doc['_esdc_clientid_value'],
        recordSource: doc.esdc_recordsource,
      })),
    };
  }
}
