import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockFn } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { getAppContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import type { DocumentUploadService } from '~/.server/domain/services';
import { getFixedT } from '~/.server/utils/locale-utils';
import { getUrl } from '~/middlewares/context-storage.server';
import type { DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { arrayBufferToBase64, isFileContentTypeAllowed } from '~/utils/file-utils';

vi.mock(import('~/.server/context'));
vi.mock(import('~/.server/context/applicant-context'));
vi.mock(import('~/.server/context/user-context'));
vi.mock(import('~/.server/utils/locale-utils'), () => ({ getFixedT: vi.fn() }));
vi.mock(import('~/middlewares/context-storage.server'));
vi.mock(import('~/utils/file-utils'));

const documentUploadServiceMock = mock<DocumentUploadService>();
const appContainerMock = mock<AppContainerProvider>();
const tMock = mockFn<TFunction<'documents'>>();

const translations = {
  upload: {
    errorMessage: {
      invalidFileType: 'invalid file type',
      scanFailed: 'scan failed',
      scanError: 'scan error',
      uploadFailed: 'upload failed',
      uploadError: 'upload error',
    },
  },
};

const getAppContextMock = vi.mocked(getAppContext, { partial: true });
const getApplicantMock = vi.mocked(getApplicant, { partial: true });
const getUserMock = vi.mocked(getUser, { partial: true });
const getFixedTMock = vi.mocked(getFixedT);
const getUrlMock = vi.mocked(getUrl);
const arrayBufferToBase64Mock = vi.mocked(arrayBufferToBase64);
const isFileContentTypeAllowedMock = vi.mocked(isFileContentTypeAllowed);

beforeEach(() => {
  vi.clearAllMocks();
  tMock.mockImplementation((selector) => selector(translations as never));
  getAppContextMock.mockReturnValue({ appContainer: appContainerMock });
  getApplicantMock.mockReturnValue({ clientNumber: 'client-123' });
  getUserMock.mockReturnValue({ id: 'user-123' });
  getUrlMock.mockReturnValue(new URL('https://example.test/documents'));
  getFixedTMock.mockResolvedValue(tMock);
  arrayBufferToBase64Mock.mockReturnValue('base64-content');
  isFileContentTypeAllowedMock.mockResolvedValue(true);

  appContainerMock.get.mockReset();
  appContainerMock.get.mockReturnValueOnce(documentUploadServiceMock).mockReturnValueOnce({
    DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  });
});

describe('protected-documents-upload-helpers.server', () => {
  describe('scanDocuments', () => {
    it('should scan valid documents', async () => {
      documentUploadServiceMock.scanDocument.mockResolvedValue({ DataId: 'scan-123' });

      await expect(scanDocuments(createFiles())).resolves.toEqual({ success: true });
      expect(documentUploadServiceMock.scanDocument).toHaveBeenCalledWith({
        fileName: 'document.txt',
        binary: 'base64-content',
        userId: 'user-123',
      });
    });

    it('should reject content whose detected type is not allowed', async () => {
      isFileContentTypeAllowedMock.mockResolvedValue(false);

      const result = await scanDocuments(createFiles());

      expect(result).toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['invalid file type'],
                    },
                  },
                },
              },
            },
          },
        },
      });
      expect(documentUploadServiceMock.scanDocument).not.toHaveBeenCalled();
    });

    it('should return service scan errors for affected files', async () => {
      documentUploadServiceMock.scanDocument.mockResolvedValue({ Error: { ErrorCode: 'SCAN-1', ErrorMessage: 'Threat detected' } });

      const result = await scanDocuments(createFiles());

      expect(result).toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['scan failed'],
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should return a scan error when scanning throws', async () => {
      documentUploadServiceMock.scanDocument.mockRejectedValue(new Error('scan unavailable'));

      await expect(scanDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['scan error'],
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  });

  describe('uploadDocuments', () => {
    beforeEach(() => {
      appContainerMock.get.mockReset();
      appContainerMock.get.mockReturnValue(documentUploadServiceMock);
    });

    it('should upload documents with applicant and user context', async () => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ DocumentFileName: 'document.txt' });

      await expect(uploadDocuments(createFiles())).resolves.toEqual({ success: true });
      expect(documentUploadServiceMock.uploadDocument).toHaveBeenCalledWith({
        clientNumber: 'client-123',
        evidentiaryDocumentTypeId: 'receipt',
        fileName: 'document.txt',
        binary: 'base64-content',
        uploadDate: expect.any(Date),
        lastModifiedDate: new Date(1_000),
        userId: 'user-123',
      });
    });

    it('should return service upload errors for affected files', async () => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ Error: { ErrorCode: 'UPLOAD-1', ErrorMessage: 'Upload rejected' } });

      await expect(uploadDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['upload failed'],
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should return an upload error when uploading throws', async () => {
      documentUploadServiceMock.uploadDocument.mockRejectedValue(new Error('upload unavailable'));

      await expect(uploadDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['upload error'],
                    },
                  },
                },
              },
            },
          },
        },
      });
    });
  });
});

function createFiles(): DocumentUploadSchemaOutput['files'] {
  const file = new File(['content'], 'document.txt', { type: 'text/plain', lastModified: 1_000 });
  return {
    first: {
      file,
      fileBuffer: new TextEncoder().encode('content').buffer,
      fileHash: 'hash',
      documentType: 'receipt',
    },
  };
}
