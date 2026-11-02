import { createInstance } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import enDocuments from '~/.server/locales/en/documents';
import frDocuments from '~/.server/locales/fr/documents';
import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { getClientEnv } from '~/utils/env-utils';
import { bytesToFilesize } from '~/utils/units-utils';

vi.mock(import('~/utils/env-utils'));

const uploadLimits = {
  DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.txt'],
  DOCUMENT_UPLOAD_MAX_FILE_COUNT: 3,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 1,
};
const getClientEnvMock = vi.mocked(getClientEnv, { partial: true });

beforeEach(() => {
  getClientEnvMock.mockReturnValue(uploadLimits);
});

describe.each(['en', 'fr'] as const)('document upload messages (%s)', (locale) => {
  async function getTranslator() {
    const i18n = createInstance();
    await i18n.init({ lng: locale, defaultNS: 'documents', resources: { en: { documents: enDocuments }, fr: { documents: frDocuments } } });
    return i18n.getFixedT(locale, 'documents');
  }

  it.each([
    { count: 0, en: 'Files selected: 0', fr: 'Fichiers sélectionnés : 0' },
    { count: 1, en: 'Files selected: 1', fr: 'Fichiers sélectionnés : 1' },
    { count: 3, en: 'Files selected: 3', fr: 'Fichiers sélectionnés : 3' },
  ])('uses the selected-files counter for $count files', async ({ count, ...expected }) => {
    const t = await getTranslator();

    expect(t(($) => $.upload.uploadFiles.filesSelected, { count })).toBe(expected[locale]);
  });

  it.each([
    { count: 0, en: 'Files uploaded: 0', fr: 'Fichiers téléversés : 0' },
    { count: 1, en: 'Files uploaded: 1', fr: 'Fichiers téléversés : 1' },
    { count: 3, en: 'Files uploaded: 3', fr: 'Fichiers téléversés : 3' },
  ])('uses the uploaded-files counter for $count files', async ({ count, ...expected }) => {
    const t = await getTranslator();

    expect(t(($) => $.upload.uploadFiles.uploadedFiles, { count })).toBe(expected[locale]);
  });

  it.each([
    { count: 0, en: 'Files not uploaded: 0', fr: 'Fichiers non téléversés : 0' },
    { count: 1, en: 'Files not uploaded: 1', fr: 'Fichiers non téléversés : 1' },
    { count: 3, en: 'Files not uploaded: 3', fr: 'Fichiers non téléversés : 3' },
  ])('uses the pending-files counter for $count files', async ({ count, ...expected }) => {
    const t = await getTranslator();

    expect(t(($) => $.upload.uploadFiles.pendingFiles, { count })).toBe(expected[locale]);
  });

  it('uses the current upload-status headings and omits the obsolete progress key', async () => {
    const t = await getTranslator();
    const expected = locale === 'en' ? { uploaded: 'Files uploaded successfully', pending: 'Files not uploaded' } : { uploaded: 'Fichiers téléversés avec succès', pending: 'Fichiers non téléversés' };

    expect(t(($) => $.upload.uploadFiles.uploadedFilesHeading)).toBe(expected.uploaded);
    expect(t(($) => $.upload.uploadFiles.pendingFilesHeading)).toBe(expected.pending);
    expect('uploadProgress' in enDocuments.upload.uploadFiles).toBe(false);
    expect('uploadProgress' in frDocuments.upload.uploadFiles).toBe(false);
  });

  it('uses the same approved wording for non-security rejections and technical failures', async () => {
    const t = await getTranslator();
    const expected =
      locale === 'en'
        ? 'An unexpected error occurred while uploading file “document.txt”. Try to upload your file again.'
        : "Une erreur s'est produite lors du téléversement du fichier «\u00A0document.txt\u00A0». Essayez de téléverser le fichier à nouveau.";

    expect(t(($) => $.upload.errorMessage.uploadFailed, { filename: 'document.txt' })).toBe(expected);
    expect(t(($) => $.upload.errorMessage.uploadError, { filename: 'document.txt' })).toBe(expected);
  });

  it('uses distinct security-check wording for unsafe files', async () => {
    const t = await getTranslator();
    const expected =
      locale === 'en' ? 'The file “document.txt” does not pass our security checks. You must choose a different file.' : 'Le fichier «\u00A0document.txt\u00A0» ne passe pas notre vérification de sécurité. Vous devez choisir un autre fichier.';
    const unsafeMessage = t(($) => $.upload.errorMessage.scanFailed, { filename: 'document.txt' });

    expect(unsafeMessage).toBe(expected);
    expect(unsafeMessage).not.toBe(t(($) => $.upload.errorMessage.uploadFailed, { filename: 'document.txt' }));
    expect(unsafeMessage).not.toBe(t(($) => $.upload.errorMessage.uploadError, { filename: 'document.txt' }));
  });

  it('validates oversized files both during selection and during submission', async () => {
    const t = await getTranslator();
    const file = new File([new Uint8Array(1024 * 1024 + 1)], 'oversized.txt');
    const selection = new FormData();
    selection.set('_validation_id', 'validation-id');
    selection.set('current_file_count', '0');
    selection.append('file_object', file);

    const submission = new FormData();
    submission.append('file_id', 'first');
    submission.append('file_object', file);
    submission.append('file_document_type', 'receipt');
    const files = await getFiles(submission);
    const filesize = bytesToFilesize(1024 * 1024, `${locale}-CA`);
    const expected = locale === 'en' ? `The file is too large to upload. Make sure the file size is less than ${filesize}.` : `La taille du fichier est trop grande. Assurez-vous que la taille du fichier est de moins de ${filesize}.`;

    await expect(validateFileSelection({ formData: selection, locale, t })).resolves.toMatchObject({
      success: false,
      errors: { properties: { files: { errors: [expected] } } },
    });
    expect(validateUploadedFiles({ files, locale, t })).toMatchObject({
      success: false,
      errors: { properties: { files: { properties: { first: { properties: { file: { errors: [expected] } } } } } } },
    });
  });

  it.each([1, 3])('rejects selection and submission above the maximum file count of %i', async (count) => {
    getClientEnvMock.mockReturnValue({ ...uploadLimits, DOCUMENT_UPLOAD_MAX_FILE_COUNT: count });
    const t = await getTranslator();
    const selection = new FormData();
    selection.set('_validation_id', 'validation-id');
    selection.set('current_file_count', String(count));
    selection.append('file_object', new File(['content'], 'extra.txt'));

    const submission = new FormData();

    for (let index = 0; index <= count; index++) {
      submission.append('file_id', String(index));
      submission.append('file_object', new File(['content'], `${index}.txt`));
      submission.append('file_document_type', 'receipt');
    }

    const files = await getFiles(submission);
    const expected =
      locale === 'en' ? `You can upload up to ${count} ${count === 1 ? 'file' : 'files'} at a time. Submit before uploading more.` : `Vous pouvez téléverser jusqu'à ${count} fichiers à la fois. Vous devez les soumettre avant d'en téleverser d'autres.`;

    await expect(validateFileSelection({ formData: selection, locale, t })).resolves.toMatchObject({
      success: false,
      errors: { properties: { files: { errors: [expected] } } },
    });
    expect(validateUploadedFiles({ files, locale, t })).toMatchObject({
      success: false,
      errors: { properties: { files: { errors: [expected] } } },
    });
  });

  it.each([1, 3])('accepts selection and submission at the maximum file count of %i', async (count) => {
    getClientEnvMock.mockReturnValue({ ...uploadLimits, DOCUMENT_UPLOAD_MAX_FILE_COUNT: count });
    const t = await getTranslator();
    const selection = new FormData();
    selection.set('_validation_id', 'validation-id');
    selection.set('current_file_count', String(count - 1));
    selection.append('file_object', new File(['extra content'], 'extra.txt'));

    const submission = new FormData();

    for (let index = 0; index < count; index++) {
      submission.append('file_id', String(index));
      submission.append('file_object', new File([`content ${index}`], `${index}.txt`));
      submission.append('file_document_type', 'receipt');
    }

    await expect(validateFileSelection({ formData: selection, locale, t })).resolves.toMatchObject({ success: true });
    const files = await getFiles(submission);
    expect(validateUploadedFiles({ files, locale, t })).toMatchObject({ success: true });
  });
});
