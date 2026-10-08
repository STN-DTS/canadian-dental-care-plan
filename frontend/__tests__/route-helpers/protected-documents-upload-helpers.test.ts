import type { TFunction } from 'i18next';
import type { LiteralToPrimitiveDeep, PartialDeep } from 'type-fest';
import { describe, expect, it, vi } from 'vitest';
import { mockFn } from 'vitest-mock-extended';

import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { getClientEnv } from '~/utils/env-utils';

vi.mock(import('~/utils/env-utils'));

const getClientEnvMock = vi.mocked(getClientEnv, { partial: true });
getClientEnvMock.mockReturnValue({
  DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  DOCUMENT_UPLOAD_MAX_FILE_COUNT: 3,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 1,
});

const tFunctionMock = mockFn<TFunction<'documents'>>().mockImplementation((selector) => {
  type SelectorTranslation = Parameters<typeof selector>[0];
  type SelectorTranslationMock = PartialDeep<LiteralToPrimitiveDeep<SelectorTranslation>>;
  const selectorTranslationMock: SelectorTranslationMock = {
    upload: {
      errorMessage: {
        duplicateFile: 'duplicate file',
        documentTypeRequired: 'document type required',
        fileRequired: 'file required',
        fileTooLarge: 'file too large',
        invalidFileType: 'invalid file type',
        tooManyFiles: 'too many files',
      },
    },
  };
  return selector(selectorTranslationMock as unknown as SelectorTranslation);
});

describe('protected-documents-upload-helpers', () => {
  describe('validateFileSelection', () => {
    it('should reject duplicate files within a selection', async () => {
      const formData = createFileSelectionFormData([new File(['same content'], 'document.txt'), new File(['same content'], 'document.txt')]);

      const actual = await validateFileSelection({ formData, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        validationId: 'validation-id',
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['duplicate file'],
            },
          },
        },
      });
    });

    it('should reject a duplicate of an existing listed file', async () => {
      const formData = createFileSelectionFormData([new File(['same content'], 'document.txt')], 2);
      formData.append('existing_file_object', new File(['pending'], 'pending.txt'));
      formData.append('existing_file_object', new File(['same content'], 'document.txt'));

      const actual = await validateFileSelection({ formData, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        validationId: 'validation-id',
        errors: { errors: [], properties: { files: { errors: ['duplicate file'] } } },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), { filename: 'document.txt' });
    });

    it.each([
      { name: 'renamed.txt', contents: 'same content' },
      { name: 'document.txt', contents: 'new contents' },
    ])('should allow a file with a different name or content: $name, $contents', async ({ name, contents }) => {
      const formData = createFileSelectionFormData([new File([contents], name)], 1);
      formData.append('existing_file_object', new File(['same content'], 'document.txt'));

      await expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock })).resolves.toEqual({
        success: true,
        validationId: 'validation-id',
        errors: undefined,
      });
    });

    it('should reject selections exceeding maximum file count', async () => {
      const formData = createFileSelectionFormData([new File(['content'], 'document.txt')], 3);

      const actual = await validateFileSelection({ formData, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        validationId: 'validation-id',
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['too many files'],
            },
          },
        },
      });
    });

    it('should reject unsupported file extensions', async () => {
      const formData = createFileSelectionFormData([new File(['content'], 'document.pdf')]);

      const actual = await validateFileSelection({ formData, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        validationId: 'validation-id',
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['invalid file type'],
            },
          },
        },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ context: 'fileSelection' }));
    });

    it('should reject files exceeding maximum size', async () => {
      const oversizedFile = new File([new Uint8Array(1024 * 1024 + 1)], 'document.txt');
      const formData = createFileSelectionFormData([oversizedFile]);

      const actual = await validateFileSelection({ formData, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        validationId: 'validation-id',
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['file too large'],
            },
          },
        },
      });
    });

    it('should reject missing validation ID', async () => {
      const formData = createFileSelectionFormData([]);
      formData.delete('_validation_id');

      await expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock })).rejects.toThrow();
    });
  });

  describe('validateUploadedFiles', () => {
    it('should reject duplicate files in the submitted batch', async () => {
      const formData = createUploadFormData([
        { id: 'first', file: new File(['same content'], 'document.txt'), documentType: 'receipt' },
        { id: 'second', file: new File(['same content'], 'document.txt'), documentType: 'receipt' },
        { id: 'third', file: new File(['new file content'], 'new-file.txt'), documentType: 'identity-document' },
      ]);

      const files = await getFiles(formData);

      expect(validateUploadedFiles({ files, locale: 'en', t: tFunctionMock })).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                second: { errors: [], properties: { file: { errors: ['duplicate file'] } } },
              },
            },
          },
        },
      });
    });

    it.each([
      { name: 'renamed.txt', contents: 'same content' },
      { name: 'document.txt', contents: 'new contents' },
    ])('should allow submitting files with a different name or content: $name, $contents', async ({ name, contents }) => {
      const formData = createUploadFormData([
        { id: 'first', file: new File(['same content'], 'document.txt'), documentType: 'receipt' },
        { id: 'second', file: new File([contents], name), documentType: 'receipt' },
      ]);

      const files = await getFiles(formData);
      const actual = validateUploadedFiles({ files, locale: 'en', t: tFunctionMock });

      expect(actual.success).toBe(true);
    });

    it('should reject an empty upload', () => {
      const actual = validateUploadedFiles({ files: new Map(), locale: 'en', t: tFunctionMock });
      expect(actual.success).toBe(false);
    });

    it('should reject a missing document type', async () => {
      const formData = new FormData();
      formData.append('file_id', 'first');
      formData.append('file_object', new File(['content'], 'document.txt'));

      const files = await getFiles(formData);
      const actual = validateUploadedFiles({ files, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                first: {
                  errors: [],
                  properties: {
                    documentType: {
                      errors: ['document type required'],
                    },
                  },
                },
              },
            },
          },
        },
      });
    });

    it('should reject an unsupported file extension', async () => {
      const formData = createUploadFormData([{ id: 'first', file: new File(['content'], 'document.pdf'), documentType: 'receipt' }]);

      const files = await getFiles(formData);
      const actual = validateUploadedFiles({ files, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                first: {
                  errors: [],
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
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ context: 'submit' }));
    });

    it('should reject uploads exceeding maximum file count', async () => {
      const entries = Array.from({ length: 4 }, (_, index) => ({
        id: String(index),
        file: new File(['content'], `${index}.txt`),
        documentType: 'receipt',
      }));

      const files = await getFiles(createUploadFormData(entries));
      const actual = validateUploadedFiles({ files, locale: 'en', t: tFunctionMock });

      expect(actual).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['too many files'],
            },
          },
        },
      });
    });
  });

  describe('getFiles', () => {
    it('should throw when a file ID has no corresponding file', async () => {
      const formData = new FormData();
      formData.append('file_id', 'missing');

      await expect(getFiles(formData)).rejects.toThrow('Expected file object at index 0');
    });
  });
});

function createFileSelectionFormData(files: ReadonlyArray<File>, currentFileCount = 0): FormData {
  const formData = new FormData();
  formData.set('_validation_id', 'validation-id');
  formData.set('current_file_count', String(currentFileCount));
  for (const file of files) formData.append('file_object', file);
  return formData;
}

function createUploadFormData(entries: ReadonlyArray<{ readonly id: string; readonly file: File; readonly documentType: string }>): FormData {
  const formData = new FormData();
  for (const { id, file, documentType } of entries) {
    formData.append('file_id', id);
    formData.append('file_object', file);
    formData.append('file_document_type', documentType);
  }
  return formData;
}
