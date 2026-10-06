import { describe, expect, it } from 'vitest';

import type { DocumentUploadRequestEntity } from '~/.server/domain/entities';
import { MockDocumentUploadRepository } from '~/.server/domain/repositories';

const uploadRequest = {
  filename: 'document.txt',
  binary: 'dGVzdA==',
  subjectPersonIdentificationID: 'client-123',
  documentCategoryText: 'receipt',
  originalDocumentCreationDate: '2026-10-06',
  transactionEntryUserID: 'user-123',
  originalDocumentLastModifiedDate: '2026-10-06',
  persist: true,
  commit: true,
} satisfies DocumentUploadRequestEntity;

describe('MockDocumentUploadRepository', () => {
  it('returns an upload error for mock-upload-failure.txt', async () => {
    const repository = new MockDocumentUploadRepository();

    await expect(repository.uploadDocument({ ...uploadRequest, filename: 'mock-upload-failure.txt' })).resolves.toEqual({
      DocumentFileName: null,
      Error: {
        ErrorCode: 'MOCK_UPLOAD_FAILURE',
        ErrorMessage: 'Mock document upload failed.',
      },
    });
  });

  it('returns success for other filenames', async () => {
    const repository = new MockDocumentUploadRepository();

    await expect(repository.uploadDocument(uploadRequest)).resolves.toEqual({
      DocumentFileName: 'document.txt',
      Error: null,
    });
  });
});
