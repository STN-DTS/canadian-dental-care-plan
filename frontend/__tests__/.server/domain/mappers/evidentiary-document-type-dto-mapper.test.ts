import { describe, expect, it } from 'vitest';

import { DefaultEvidentiaryDocumentTypeDtoMapper } from '~/.server/domain/mappers';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';

describe('DefaultEvidentiaryDocumentTypeDtoMapper', () => {
  const mapper = new DefaultEvidentiaryDocumentTypeDtoMapper();

  it('maps statecode to document type status', () => {
    const dto = mapper.mapEvidentiaryDocumentTypeEntityToEvidentiaryDocumentTypeDto({
      esdc_evidentiarydocumenttypeid: 'document-type-1',
      esdc_value: 'TYPE-1',
      esdc_nameenglish: 'Document type',
      esdc_namefrench: 'Type de document',
      statecode: 0,
    });

    expect(dto).toStrictEqual({
      id: 'document-type-1',
      code: 'TYPE-1',
      nameEn: 'Document type',
      nameFr: 'Type de document',
      status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active,
    });
  });

  it('preserves status when localizing a document type', () => {
    const localizedDto = mapper.mapEvidentiaryDocumentTypeDtoToEvidentiaryDocumentTypeLocalizedDto(
      {
        id: 'document-type-1',
        code: 'TYPE-1',
        nameEn: 'Document type',
        nameFr: 'Type de document',
        status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive,
      },
      'fr',
    );

    expect(localizedDto).toStrictEqual({
      id: 'document-type-1',
      code: 'TYPE-1',
      name: 'Type de document',
      status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.inactive,
    });
  });
});
