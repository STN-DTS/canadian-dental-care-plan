import type { TFunction } from 'i18next';
import type { LiteralToPrimitiveDeep, PartialDeep } from 'type-fest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockFn } from 'vitest-mock-extended';

import { getFiles, validateFileSelection, validateUploadedFileContents, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { getClientEnv } from '~/utils/env-utils';

vi.mock(import('~/utils/env-utils'));

const getClientEnvMock = vi.mocked(getClientEnv, { partial: true });

beforeEach(() => {
  vi.clearAllMocks();
  getClientEnvMock.mockReturnValue({
    DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: [
      { extension: '.txt', nameEn: 'Plain text file', nameFr: 'Fichier texte brut' },
      { extension: '.rtf', nameEn: 'Rich Text Format document', nameFr: 'Document en format texte enrichi' },
    ],
    DOCUMENT_UPLOAD_MAX_FILE_COUNT: 3,
    DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 1,
  });
});

const tFunctionMock = mockFn<TFunction<'documents'>>().mockImplementation((selector) => {
  type SelectorTranslation = Parameters<typeof selector>[0];
  type SelectorTranslationMock = PartialDeep<LiteralToPrimitiveDeep<SelectorTranslation>>;
  const selectorTranslationMock: SelectorTranslationMock = {
    upload: {
      errorMessage: {
        contentValidationError: 'content validation error',
        duplicateFile: 'duplicate file',
        documentTypeRequired: 'document type required',
        fileRequired: 'file required',
        fileTooLarge: 'file too large',
        invalidFileContent: 'invalid file content',
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
      const args = createFileSelectionArgs([new File(['same content'], 'document.txt', { type: 'text/plain' }), new File(['same content'], 'document.txt', { type: 'text/plain' })]);

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
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
      const args = createFileSelectionArgs([new File(['same content'], 'document.txt', { type: 'text/plain' })], 2, [new File(['pending'], 'pending.txt', { type: 'text/plain' }), new File(['same content'], 'document.txt', { type: 'text/plain' })]);

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
        errors: { errors: [], properties: { files: { errors: ['duplicate file'] } } },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), { filename: 'document.txt' });
    });

    it.each([
      { name: 'renamed.txt', contents: 'same content' },
      { name: 'document.txt', contents: 'new contents' },
    ])('should allow a file with a different name or content: $name, $contents', async ({ name, contents }) => {
      const args = createFileSelectionArgs([new File([contents], name, { type: 'text/plain' })], 1, [new File(['same content'], 'document.txt', { type: 'text/plain' })]);

      await expect(validateFileSelection(args)).resolves.toEqual({
        success: true,
        errors: undefined,
      });
    });

    it('should reject selections exceeding maximum file count', async () => {
      const args = createFileSelectionArgs([new File(['content'], 'document.txt', { type: 'text/plain' })], 3);

      const actual = await validateFileSelection(args);

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

    it('should reject unsupported file extensions', async () => {
      const args = createFileSelectionArgs([new File(['content'], 'document.pdf', { type: 'application/pdf' })]);

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
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

    it.each([
      { locale: 'en', expectedTypeName: 'Rich Text Format document' },
      { locale: 'fr', expectedTypeName: 'Document en format texte enrichi' },
    ])('should reject a file whose content does not match its supported extension ($locale)', async ({ locale, expectedTypeName }) => {
      const args = {
        ...createFileSelectionArgs([new File(['not rtf content'], 'letter.rtf', { type: 'application/rtf' })]),
        locale,
      };

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['invalid file content'],
            },
          },
        },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
        filename: 'letter.rtf',
        fileTypeName: expectedTypeName,
        fileExtension: '.rtf',
      });
    });

    it('should accept files with uppercase allowed extensions during selection', async () => {
      const args = createFileSelectionArgs([new File(['Plain text'], 'NOTES.TXT', { type: 'text/plain' }), new File([String.raw`{\rtf1\ansi Test}`], 'LETTER.RTF', { type: 'application/rtf' })]);

      await expect(validateFileSelection(args)).resolves.toEqual({
        success: true,
        errors: undefined,
      });
    });

    it('should reject mismatched content for an uppercase allowed extension with invalidFileContent', async () => {
      const args = createFileSelectionArgs([new File(['not rtf content'], 'LETTER.RTF', { type: 'application/rtf' })]);

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['invalid file content'],
            },
          },
        },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
        filename: 'LETTER.RTF',
        fileTypeName: 'Rich Text Format document',
        fileExtension: '.rtf',
      });
    });

    it('should reject files exceeding maximum size', async () => {
      const oversizedFile = new File([new Uint8Array(1024 * 1024 + 1)], 'document.txt', { type: 'text/plain' });
      const args = createFileSelectionArgs([oversizedFile]);

      const actual = await validateFileSelection(args);

      expect(actual).toEqual({
        success: false,
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
  });

  describe('validateUploadedFileContents', () => {
    it('should accept files whose content matches their allowed extension', async () => {
      const formData = createUploadFormData([
        { id: 'first', file: new File([String.raw`{\rtf1\ansi Test}`], 'letter.rtf', { type: 'application/rtf' }), documentType: 'receipt' },
        { id: 'second', file: new File(['Plain text'], 'notes.txt', { type: 'text/plain' }), documentType: 'receipt' },
      ]);
      const files = await getFiles(formData);

      await expect(validateUploadedFileContents({ files: Object.fromEntries(files), locale: 'en', t: tFunctionMock })).resolves.toEqual({ success: true });
    });

    it('should reject an unconfigured extension before checking content', async () => {
      const formData = createUploadFormData([{ id: 'first', file: new File(['content'], 'document.exe', { type: 'application/octet-stream' }), documentType: 'receipt' }]);
      const files = await getFiles(formData);

      await expect(validateUploadedFileContents({ files: Object.fromEntries(files), locale: 'en', t: tFunctionMock })).resolves.toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                first: { errors: [], properties: { file: { errors: ['invalid file type'] } } },
              },
            },
          },
        },
      });
    });

    it('should reject mismatched content with localized file type metadata', async () => {
      const formData = createUploadFormData([{ id: 'first', file: new File(['plain text disguised as rtf'], 'letter.rtf', { type: 'application/rtf' }), documentType: 'receipt' }]);
      const files = await getFiles(formData);

      await expect(validateUploadedFileContents({ files: Object.fromEntries(files), locale: 'fr', t: tFunctionMock })).resolves.toEqual({
        success: false,
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                first: { errors: [], properties: { file: { errors: ['invalid file content'] } } },
              },
            },
          },
        },
      });
      expect(tFunctionMock).toHaveBeenCalledWith(expect.any(Function), {
        filename: 'letter.rtf',
        fileTypeName: 'Document en format texte enrichi',
        fileExtension: '.rtf',
      });
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

    it('should accept submitted files with uppercase allowed extensions', async () => {
      const formData = createUploadFormData([
        { id: 'first', file: new File(['Plain text'], 'NOTES.TXT', { type: 'text/plain' }), documentType: 'receipt' },
        { id: 'second', file: new File([String.raw`{\rtf1\ansi Test}`], 'LETTER.RTF', { type: 'application/rtf' }), documentType: 'receipt' },
      ]);

      const files = await getFiles(formData);

      expect(validateUploadedFiles({ files, locale: 'en', t: tFunctionMock }).success).toBe(true);
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

function createFileSelectionArgs(files: ReadonlyArray<File>, currentFileCount = 0, existingFiles: ReadonlyArray<File> = []) {
  return { currentFileCount, existingFiles, files, locale: 'en', t: tFunctionMock };
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
