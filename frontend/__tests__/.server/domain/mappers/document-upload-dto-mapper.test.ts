import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { DefaultDocumentUploadDtoMapper } from '~/.server/domain/mappers/document-upload-dto-mapper';
import type { EvidentiaryDocumentTypeService } from '~/.server/domain/services';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';

describe('document upload timestamp contracts', () => {
  it.each([
    ['2026-10-27T12:00:00Z', '2026-10-27T12:00:00Z'],
    ['2026-10-27T12:00:00.123456789Z', '2026-10-27T12:00:00.123456789Z'],
  ])('serializes the upload instant %s with default precision', async (timestamp, expectedTimestamp) => {
    const typeService = mock<EvidentiaryDocumentTypeService>();
    typeService.getEvidentiaryDocumentTypeById.mockResolvedValue({
      id: 'receipt',
      code: 'RECEIPT',
      nameEn: 'Receipt',
      nameFr: 'Receipt',
      status: EVIDENTIARY_DOCUMENT_TYPE_STATUS.active,
    });
    const mapper = new DefaultDocumentUploadDtoMapper(typeService);

    const entity = await mapper.mapDocumentUploadRequestDtoToEntity({
      fileName: 'receipt.pdf',
      binary: 'Y29udGVudA==',
      clientNumber: 'client-123',
      userId: 'user-123',
      evidentiaryDocumentTypeId: 'receipt',
      uploadDate: Temporal.Instant.from(timestamp),
      lastModifiedDate: Temporal.Instant.fromEpochMilliseconds(-1),
    });

    expect(entity).toEqual({
      filename: 'receipt.pdf',
      binary: 'Y29udGVudA==',
      subjectPersonIdentificationID: 'client-123',
      transactionEntryUserID: 'user-123',
      documentCategoryText: 'RECEIPT',
      originalDocumentCreationDate: expectedTimestamp,
      originalDocumentLastModifiedDate: '1969-12-31T23:59:59.999Z',
      persist: true,
      commit: true,
    });
    expect(JSON.parse(JSON.stringify(entity))).toEqual(entity);
  });
});
