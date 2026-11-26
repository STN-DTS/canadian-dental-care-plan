import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { clientEnvSchema, getClientEnv } from '~/utils/env-utils';
import { isValidExtension } from '~/utils/file-utils';

/*
 * @vitest-environment jsdom
 */

describe('getClientEnv', () => {
  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('should return the public environment variables from the window object when called from a client-side browser', () => {
    const env = {
      I18NEXT_DEBUG: true,
      HCAPTCHA_SITE_KEY: 'hcaptcha-site-key',
    };

    vi.stubGlobal('document', new Document());
    vi.stubGlobal('window', { env });

    expect(getClientEnv()).toMatchObject(env);
  });

  it('should return the public environment variables from process.env when called from a server-side component', () => {
    vi.stubGlobal('document', undefined);
    vi.stubEnv('I18NEXT_DEBUG', 'true');
    vi.stubEnv('HCAPTCHA_SITE_KEY', 'hcaptcha-site-key');

    expect(getClientEnv()).toMatchObject({ I18NEXT_DEBUG: true });
  });
});

describe('clientEnvSchema DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES', () => {
  it('uses the 13 default file types when unset', () => {
    const result = clientEnvSchema.safeParse({});

    assert(result.success);
    const fileTypes = result.data.DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES;

    expect(fileTypes.map(({ extension }) => extension)).toEqual(['.pdf', '.docx', '.rtf', '.xlsx', '.pptx', '.txt', '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tif', '.tiff']);
    expect(fileTypes.every(({ extension, nameEn, nameFr }) => isValidExtension(extension) && nameEn.trim().length > 0 && nameFr.trim().length > 0)).toBe(true);
    expect(new Set(fileTypes.map(({ extension }) => extension)).size).toBe(fileTypes.length);
    expect(clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: JSON.stringify(fileTypes) }).success).toBe(true);
  });

  it('parses a custom JSON array and normalizes extension, nameEn, and nameFr', () => {
    const raw = JSON.stringify([
      { extension: '  .PDF  ', nameEn: '  PDF/A (v1.4) document  ', nameFr: "  Document d'archive PDF/A (v1.4)  " },
      { extension: '.DOCX', nameEn: 'Microsoft Word document', nameFr: 'Présentation & document Microsoft Word' },
    ]);

    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: raw });

    assert(result.success);
    expect(result.data.DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES).toEqual([
      { extension: '.pdf', nameEn: 'PDF/A (v1.4) document', nameFr: "Document d'archive PDF/A (v1.4)" },
      { extension: '.docx', nameEn: 'Microsoft Word document', nameFr: 'Présentation & document Microsoft Word' },
    ]);
  });

  it('rejects malformed JSON with a Zod invalid_format error', () => {
    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: '[{"extension":".pdf"' });

    assert(!result.success);
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: 'invalid_format',
        format: 'json',
        path: ['DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES'],
      }),
    );
  });

  it.each(['{}', '"string"', '123', '[]'])('rejects non-array or empty JSON value %s', (value) => {
    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: value });

    expect(result.success).toBe(false);
  });

  it.each(['pdf', '.notarealextension', ''])('rejects invalid extension %j', (extension) => {
    const raw = JSON.stringify([{ extension, nameEn: 'Test file', nameFr: 'Fichier test' }]);
    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: raw });

    expect(result.success).toBe(false);
  });

  it.each([
    { extension: '.pdf', nameEn: '', nameFr: 'Document PDF' },
    { extension: '.pdf', nameEn: '   ', nameFr: 'Document PDF' },
    { extension: '.pdf', nameEn: 'PDF document', nameFr: '' },
    { extension: '.pdf', nameEn: 'PDF document', nameFr: '   ' },
    { extension: '.pdf', nameEn: 'PDF document' },
    { extension: '.pdf', nameFr: 'Document PDF' },
  ])('rejects missing or blank labels %j', (entry) => {
    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: JSON.stringify([entry]) });

    expect(result.success).toBe(false);
  });

  it.each(['</script>', '<b>PDF</b>', 'PDF\ndocument', 'PDF;document', '{PDF}'])('rejects unsupported characters in labels (%j)', (badLabel) => {
    const badEn = clientEnvSchema.safeParse({
      DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: JSON.stringify([{ extension: '.pdf', nameEn: badLabel, nameFr: 'Document PDF' }]),
    });
    const badFr = clientEnvSchema.safeParse({
      DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: JSON.stringify([{ extension: '.pdf', nameEn: 'PDF document', nameFr: badLabel }]),
    });

    expect(badEn.success).toBe(false);
    expect(badFr.success).toBe(false);
  });

  it('rejects duplicate extensions regardless of case or surrounding whitespace', () => {
    const raw = JSON.stringify([
      { extension: '.pdf', nameEn: 'PDF document', nameFr: 'Document PDF' },
      { extension: ' .PDF ', nameEn: 'Portable Document Format', nameFr: 'Format de document portable' },
    ]);

    const result = clientEnvSchema.safeParse({ DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES: raw });

    assert(!result.success);
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        code: 'custom',
        message: 'Duplicate file extensions are not allowed',
        path: ['DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES'],
      }),
    );
  });
});
