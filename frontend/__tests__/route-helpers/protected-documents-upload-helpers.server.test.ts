import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock, mockFn } from 'vitest-mock-extended';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import { TYPES } from '~/.server/constants';
import { getAppContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import type { DocumentUploadService } from '~/.server/domain/services';
import { getFixedT } from '~/.server/utils/locale-utils';
import { getUrl } from '~/middlewares/context-storage.server';
import type { DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { uploadDocuments, validateDocumentContents } from '~/route-helpers/protected-documents-upload-helpers.server';
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
      contentValidationError: 'content validation error',
      uploadFailed: 'upload failed',
      uploadError: 'upload error',
      scanFailed: 'file not safe',
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
  documentUploadServiceMock.uploadDocument.mockReset();
  documentUploadServiceMock.scanDocument.mockReset();
  tMock.mockImplementation((selector) => selector(translations as never));
  getAppContextMock.mockReturnValue({ appContainer: appContainerMock });
  getApplicantMock.mockReturnValue({ clientNumber: 'client-123' });
  getUserMock.mockReturnValue({ id: 'user-123' });
  getUrlMock.mockReturnValue(new URL('https://example.test/documents'));
  getFixedTMock.mockResolvedValue(tMock);
  arrayBufferToBase64Mock.mockReturnValue('base64-content');
  isFileContentTypeAllowedMock.mockResolvedValue(true);

  appContainerMock.get.mockReset();
  appContainerMock.get.mockReturnValue({
    DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  });
});

describe('protected-documents-upload-helpers.server', () => {
  describe('validateDocumentContents', () => {
    it('should accept allowed content using only server configuration', async () => {
      await expect(validateDocumentContents(createFiles())).resolves.toEqual({ success: true });
      expect(isFileContentTypeAllowedMock).toHaveBeenCalledWith({
        allowedExtensions: ['.txt'],
        declaredMimeType: 'text/plain',
        fileBuffer: new TextEncoder().encode('content').buffer,
      });
      expect(appContainerMock.get).toHaveBeenCalledOnce();
      expect(appContainerMock.get).toHaveBeenCalledWith(TYPES.ServerConfig);
      expect(documentUploadServiceMock.scanDocument).not.toHaveBeenCalled();
    });

    it('should reject content whose detected type is not allowed', async () => {
      isFileContentTypeAllowedMock.mockResolvedValue(false);

      const result = await validateDocumentContents(createFiles());

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

    it('should translate unexpected content validation errors for affected files', async () => {
      isFileContentTypeAllowedMock.mockRejectedValue(new Error('content detection unavailable'));

      const result = await validateDocumentContents(createFiles());

      expect(result).toMatchObject({
        success: false,
        errors: {
          properties: {
            files: {
              properties: {
                first: {
                  properties: {
                    file: {
                      errors: ['content validation error'],
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
      vi.useFakeTimers();
      const uploadDate = new Date('2026-10-27T17:00:00Z');
      vi.setSystemTime(uploadDate);
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ status: 'success', documentFileName: 'document.txt' });

      await expect(uploadDocuments(createFiles())).resolves.toEqual({ success: true });
      expect(documentUploadServiceMock.uploadDocument).toHaveBeenCalledWith({
        clientNumber: 'client-123',
        evidentiaryDocumentTypeId: 'receipt',
        fileName: 'document.txt',
        binary: 'base64-content',
        uploadDate,
        lastModifiedDate: new Date(1_000),
        userId: 'user-123',
      });
      expect(documentUploadServiceMock.uploadDocument).toHaveBeenCalledOnce();
      expect(documentUploadServiceMock.scanDocument).not.toHaveBeenCalled();
    });

    it('should return service upload errors for affected files', async () => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ status: 'rejected', error: { errorCode: 'UPLOAD-1', errorMessage: 'Upload rejected' } });

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

    it.each([
      ['EICAR_DETECTED', 'Threat detected'],
      ['400', 'Threat detected'],
      ['400', 'Missing mandatory field'],
      ['404', 'Document not found'],
      ['400', 'File not safe'],
    ])('should translate the rejected status without reclassifying code %s and message %s', async (errorCode, errorMessage) => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ status: 'rejected', error: { errorCode, errorMessage } });

      await expect(uploadDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: { properties: { files: { properties: { first: { properties: { file: { errors: ['upload failed'] } } } } } } },
      });
    });

    it('should display the security-check message for an unsafe file', async () => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ status: 'unsafe', error: { errorCode: '400', errorMessage: 'File not safe' } });

      await expect(uploadDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: { properties: { files: { properties: { first: { properties: { file: { errors: ['file not safe'] } } } } } } },
      });
      expect(tMock).toHaveBeenCalledWith(expect.any(Function), { filename: 'document.txt' });
    });

    it.each([new Error('internal upstream details'), 'internal upstream details', null, undefined])('should translate a technical error without exposing details: %s', async (error) => {
      documentUploadServiceMock.uploadDocument.mockResolvedValue({ status: 'error', error });

      await expect(uploadDocuments(createFiles())).resolves.toMatchObject({
        success: false,
        errors: { properties: { files: { properties: { first: { properties: { file: { errors: ['upload error'] } } } } } } },
      });
    });

    it('should keep successful files out of the error tree for mixed outcomes', async () => {
      documentUploadServiceMock.uploadDocument
        .mockResolvedValueOnce({ status: 'success', documentFileName: 'document.txt' })
        .mockResolvedValueOnce({ status: 'rejected', error: { errorCode: 'REJECTED', errorMessage: 'Rejected' } })
        .mockResolvedValueOnce({ status: 'error', error: new Error('upload unavailable') })
        .mockResolvedValueOnce({ status: 'unsafe', error: { errorCode: '400', errorMessage: 'File not safe' } });

      const files = createFiles();
      await expect(uploadDocuments({ ...files, second: files.first, third: files.first, fourth: files.first })).resolves.toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                second: { errors: [], properties: { file: { errors: ['upload failed'] } } },
                third: { errors: [], properties: { file: { errors: ['upload error'] } } },
                fourth: { errors: [], properties: { file: { errors: ['file not safe'] } } },
              },
            },
          },
        },
      });
      expect(documentUploadServiceMock.uploadDocument).toHaveBeenCalledTimes(4);
    });
  });
});

function createFiles() {
  const file = new File(['content'], 'document.txt', { type: 'text/plain', lastModified: 1_000 });
  return {
    first: {
      file,
      fileBuffer: new TextEncoder().encode('content').buffer,
      fileHash: 'hash',
      documentType: 'receipt',
    },
  } satisfies DocumentUploadSchemaOutput['files'];
}
