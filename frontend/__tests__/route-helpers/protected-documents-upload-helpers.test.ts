import type { TFunction } from 'i18next';
import type { LiteralToPrimitiveDeep, PartialDeep } from 'type-fest';
import { describe, expect, it, vi } from 'vitest';
import { mockFn } from 'vitest-mock-extended';

import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
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
    it('should allow selecting duplicate files', () => {
      const formData = createFileSelectionFormData([new File(['same content'], 'document.txt'), new File(['same content'], 'document.txt')]);

      expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock })).toEqual({
        validationId: 'validation-id',
        errors: undefined,
      });
    });

    it('should reject selections exceeding maximum file count', () => {
      const formData = createFileSelectionFormData([new File(['content'], 'document.txt')], 3);

      expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock }).errors?.properties?.files?.errors).toEqual(['too many files']);
    });

    it('should reject unsupported file extensions', () => {
      const formData = createFileSelectionFormData([new File(['content'], 'document.pdf')]);

      expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock }).errors?.properties?.files?.errors).toEqual(['invalid file type']);
    });

    it('should reject files exceeding maximum size', () => {
      const oversizedFile = new File([new Uint8Array(1024 * 1024 + 1)], 'document.txt');
      const formData = createFileSelectionFormData([oversizedFile]);

      expect(validateFileSelection({ formData, locale: 'en', t: tFunctionMock }).errors?.properties?.files?.errors).toEqual(['file too large']);
    });

    it('should reject missing validation ID', () => {
      const formData = createFileSelectionFormData([]);
      formData.delete('_validation_id');

      expect(() => validateFileSelection({ formData, locale: 'en', t: tFunctionMock })).toThrow();
    });
  });

  describe('validateUploadForm', () => {
    it('should allow submitting duplicate files', async () => {
      const formData = createUploadFormData([
        { id: 'first', file: new File(['same content'], 'document.txt'), documentType: 'receipt' },
        { id: 'second', file: new File(['same content'], 'document.txt'), documentType: 'receipt' },
      ]);

      await expect(validateUploadForm({ formData, locale: 'en', t: tFunctionMock })).resolves.toMatchObject({ success: true });
    });

    it('should reject an empty upload', async () => {
      const result = await validateUploadForm({ formData: new FormData(), locale: 'en', t: tFunctionMock });

      expect(result.success).toBe(false);
    });

    it('should reject a missing document type', async () => {
      const formData = new FormData();
      formData.append('file_id', 'first');
      formData.append('file_object', new File(['content'], 'document.txt'));

      const result = await validateUploadForm({ formData, locale: 'en', t: tFunctionMock });

      expect(result).toMatchObject({
        success: false,
        errors: { properties: { files: { properties: { first: { properties: { documentType: { errors: ['document type required'] } } } } } } },
      });
    });

    it('should reject an unsupported file extension', async () => {
      const formData = createUploadFormData([{ id: 'first', file: new File(['content'], 'document.pdf'), documentType: 'receipt' }]);

      const result = await validateUploadForm({ formData, locale: 'en', t: tFunctionMock });

      expect(result).toMatchObject({
        success: false,
        errors: { properties: { files: { properties: { first: { properties: { file: { errors: ['invalid file type'] } } } } } } },
      });
    });

    it('should reject uploads exceeding maximum file count', async () => {
      const entries = Array.from({ length: 4 }, (_, index) => ({
        id: String(index),
        file: new File(['content'], `${index}.txt`),
        documentType: 'receipt',
      }));

      const result = await validateUploadForm({ formData: createUploadFormData(entries), locale: 'en', t: tFunctionMock });

      expect(result).toMatchObject({ success: false, errors: { properties: { files: { errors: ['too many files'] } } } });
    });

    it('should throw when a file ID has no corresponding file', async () => {
      const formData = new FormData();
      formData.append('file_id', 'missing');

      await expect(validateUploadForm({ formData, locale: 'en', t: tFunctionMock })).rejects.toThrow('Expected file object at index 0');
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
