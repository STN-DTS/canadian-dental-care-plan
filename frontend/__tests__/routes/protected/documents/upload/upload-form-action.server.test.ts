import { RouterContextProvider } from 'react-router';

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { finishDocumentUploadState, getDocumentUploadStateIdFromUrl, getDocumentUploadSubmittedUrl, loadDocumentUploadState, recordDocumentUploadAttempt, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { getFiles, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { uploadDocuments, validateDocumentContents } from '~/route-helpers/protected-documents-upload-helpers.server';
import { action } from '~/routes/protected/documents/upload/upload-form-action.server';
import { getLanguage } from '~/utils/locale-utils';

vi.mock(import('node:crypto'));
vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'));
vi.mock(import('~/.server/utils/locale-utils'));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers.server'));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers'));
vi.mock(import('~/utils/locale-utils'));

const submittedUrl = '/en/protected/documents/submitted?id=upload-id';
const uploadId = '00000000-0000-0000-0000-000000000000';

function createUploadFormData(entries: ReadonlyArray<{ id: string; file: File; documentType?: string }>) {
  const formData = new FormData();
  formData.set('_action', 'upload');

  for (const { id, file, documentType } of entries) {
    formData.append('file_id', id);
    formData.append('file_object', file, file.name);

    if (documentType !== undefined) {
      formData.append('file_document_type', documentType);
    }
  }

  return formData;
}

function createRequest(formData: FormData) {
  return mock<Request>({
    clone: () => mock<Request>({ formData: async () => await Promise.resolve(formData) }),
    formData: async () => await Promise.resolve(formData),
  });
}

type ActionArgs = Parameters<typeof action>[0];

function createActionArgs(formData: FormData): ActionArgs {
  const session = mock<Session>({ id: 'session-1' });
  const context = new RouterContextProvider();
  context.set(appContext, mock<AppContext>({ session }));
  return {
    request: createRequest(formData),
    url: new URL('http://localhost/en/protected/documents/upload/session-1'),
    context,
    params: { id: 'session-1', lang: 'en' },
    pattern: '/:lang/protected/documents/upload/:id',
  };
}

const validUploadFormData = () => createUploadFormData([{ id: 'file-1', file: new File(['content'], 'document.pdf'), documentType: 'receipt' }]);

const parsedFiles: Awaited<ReturnType<typeof getFiles>> = new Map([['file-1', { file: new File(['content'], 'document.pdf'), fileBuffer: new ArrayBuffer(7), fileHash: 'file-hash', documentType: 'receipt' }]]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue(uploadId) });
  vi.stubGlobal('env', {
    DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.pdf'],
    DOCUMENT_UPLOAD_MAX_FILE_COUNT: 10,
    DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 5,
  });
  vi.mocked(getFiles).mockResolvedValue(parsedFiles);
  vi.mocked(validateUploadedFiles).mockReturnValue({
    success: true,
    data: { files: Object.fromEntries(parsedFiles) },
  });
  vi.mocked(getDocumentUploadStateIdFromUrl).mockReturnValue(uploadId);
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(getLanguage).mockReturnValue('en');
  vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'initialized', documents: [] });
  vi.mocked(validateDocumentContents).mockResolvedValue({ success: true });
  vi.mocked(updateDocumentUploadState).mockReturnValue({ id: uploadId, status: 'initialized', documents: [] });
  vi.mocked(uploadDocuments).mockResolvedValue({ success: true, uploadDates: { 'file-1': '2026-11-01T06:30:00Z', 'file-2': '2026-11-01T06:30:01Z' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('action', () => {
  it.each([
    { caseName: 'file IDs', field: 'file_id', value: 'pending-file' },
    { caseName: 'file contents', field: 'file_object', value: new File(['content'], 'document.pdf') },
    { caseName: 'empty files', field: 'file_object', value: new File([], 'empty.pdf') },
    { caseName: 'files under another field name', field: 'attachment', value: new File(['content'], 'document.pdf') },
  ])('rejects finish requests containing $caseName without changing the flow', async ({ field, value }) => {
    const formData = new FormData();
    formData.set('_action', 'finish');
    formData.set(field, value);

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 400 } });
    expect(finishDocumentUploadState).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(getFiles).not.toHaveBeenCalled();
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(validateDocumentContents).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('clears stale pending metadata and completes the flow without processing file bytes', async () => {
    const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', documentType: 'receipt', fileSize: 8, status: 'uploaded' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [{ ...uploadedDocument, id: 'removed-file', status: 'pending' }, uploadedDocument] });
    const formData = new FormData();
    formData.set('_action', 'finish');
    const args = createActionArgs(formData);
    const { session } = args.context.get(appContext);

    const response = await action(args);

    expect(updateDocumentUploadState).toHaveBeenCalledExactlyOnceWith({ id: uploadId, session, params: args.params, state: { documents: [uploadedDocument] } });
    expect(vi.mocked(updateDocumentUploadState).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(finishDocumentUploadState).mock.invocationCallOrder[0]!);
    expect(finishDocumentUploadState).toHaveBeenCalledWith({ id: uploadId, session, params: args.params });
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).headers.get('Location')).toBe(submittedUrl);
    expect((response as Response).headers.get('X-Remix-Replace')).toBe('true');
    expect(getFiles).not.toHaveBeenCalled();
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('rejects completion with no successful uploads without clearing pending metadata', async () => {
    const formData = new FormData();
    formData.set('_action', 'finish');

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 409 } });
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(finishDocumentUploadState).not.toHaveBeenCalled();
  });

  it('rejects duplicate file IDs before processing file bytes', async () => {
    const formData = createUploadFormData([
      { id: 'file-1', file: new File(['first'], 'first.pdf'), documentType: 'receipt' },
      { id: 'file-1', file: new File(['second'], 'second.pdf'), documentType: 'receipt' },
    ]);

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 400 } });
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it.each(['empty batch', 'missing file', 'missing ID', 'text instead of a file'])('rejects an upload with $0 before changing state', async (caseName) => {
    const formData = new FormData();
    formData.set('_action', 'upload');

    if (caseName !== 'empty batch' && caseName !== 'missing ID') {
      formData.set('file_id', 'file-1');
    }

    if (caseName === 'missing ID') {
      formData.set('file_object', new File(['content'], 'document.pdf'));
    }

    if (caseName === 'text instead of a file') {
      formData.set('file_object', 'document.pdf');
    }

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 400 } });
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(validateDocumentContents).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(finishDocumentUploadState).not.toHaveBeenCalled();
  });

  it('rejects resubmission of an uploaded ID without changing state', async () => {
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [{ id: 'file-1', fileName: 'document.pdf', documentType: 'receipt', fileSize: 7, status: 'uploaded' }] });

    await expect(action(createActionArgs(validUploadFormData()))).rejects.toMatchObject({ init: { status: 409 } });
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('returns validation errors without validating content for invalid upload data', async () => {
    const { validateUploadedFiles: validateUploadedFilesActual } = await vi.importActual<{ validateUploadedFiles: typeof validateUploadedFiles }>('~/route-helpers/protected-documents-upload-helpers');
    const filesWithoutDocumentType: Awaited<ReturnType<typeof getFiles>> = new Map([['file-1', { file: new File(['content'], 'document.pdf'), fileBuffer: new ArrayBuffer(7), fileHash: 'file-hash', documentType: '' }]]);
    vi.mocked(getFiles).mockResolvedValue(filesWithoutDocumentType);
    vi.mocked(validateUploadedFiles).mockImplementation(validateUploadedFilesActual);
    const args = createActionArgs(createUploadFormData([{ id: 'file-1', file: new File(['content'], 'document.pdf') }]));

    const result = await action(args);

    expect(result).toEqual({
      data: {
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                'file-1': {
                  errors: [],
                  properties: {
                    documentType: {
                      errors: [expect.anything()],
                    },
                  },
                },
              },
            },
          },
        },
        formAction: 'upload',
        source: 'server',
        responseType: 'validation-errors',
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(validateDocumentContents).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('replaces stale pending metadata with the submitted batch even when content validation fails', async () => {
    const args = createActionArgs(validUploadFormData());
    const { session } = args.context.get(appContext);
    const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', documentType: 'receipt', fileSize: 8, status: 'uploaded' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [{ id: 'removed-file', fileName: 'removed.pdf', documentType: 'receipt', fileSize: 7, status: 'pending' }, uploadedDocument] });
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: ['invalid file type'] } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(validateDocumentContents).mockResolvedValue({ success: false, errors });

    const result = await action(args);

    expect(result).toEqual({
      data: {
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                'file-1': {
                  errors: ['invalid file type'],
                },
              },
            },
          },
        },
        formAction: 'upload',
        source: 'server',
        responseType: 'content-validation-errors',
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).toHaveBeenCalledExactlyOnceWith({
      id: uploadId,
      session,
      params: args.params,
      state: { documents: [uploadedDocument, { id: 'file-1', fileName: 'document.pdf', documentType: 'receipt', fileSize: 7, status: 'pending' }] },
    });
    expect(vi.mocked(updateDocumentUploadState).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(validateDocumentContents).mock.invocationCallOrder[0]!);
  });

  it('returns upload errors without starting submitted state', async () => {
    const args = createActionArgs(validUploadFormData());
    const { session } = args.context.get(appContext);
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors, uploadDates: {} });

    const result = await action(args);

    expect(loadDocumentUploadState).toHaveBeenCalledWith({ id: args.params.id, session, params: args.params });
    expect(validateDocumentContents).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: {
        errors,
        formAction: 'upload',
        source: 'server',
        responseType: 'upload-errors',
        documents: [
          {
            documentType: 'receipt',
            fileName: 'document.pdf',
            fileSize: 7,
            id: 'file-1',
            status: 'pending',
          },
        ],
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(updateDocumentUploadState).toHaveBeenCalledWith({
      id: uploadId,
      session,
      params: args.params,
      state: {
        documents: [
          {
            documentType: 'receipt',
            fileName: 'document.pdf',
            fileSize: 7,
            id: 'file-1',
            status: 'pending',
          },
        ],
      },
    });
  });

  it.each(['en', 'fr'] as const)('preserves order and dates across a %s partial retry while replacing pending metadata', async (locale) => {
    const retryFile = new File(['retry'], 'retry.pdf');
    const newFile = new File(['new'], 'new.pdf');
    const retryDocument = { id: 'file-1', fileName: retryFile.name, fileSize: retryFile.size, documentType: 'receipt', status: 'pending' as const };
    const uploadedDocument = { id: 'file-2', fileName: 'uploaded.pdf', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const, uploadDate: '2026-11-01T05:30:00Z' };
    const newDocument = { id: 'file-3', fileName: newFile.name, fileSize: newFile.size, documentType: 'receipt', status: 'pending' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [retryDocument, uploadedDocument, { ...retryDocument, id: 'removed' }] });
    const files = {
      'file-1': { file: retryFile, fileBuffer: new ArrayBuffer(retryFile.size), fileHash: 'retry-hash', documentType: 'receipt' },
      'file-3': { file: newFile, fileBuffer: new ArrayBuffer(newFile.size), fileHash: 'new-hash', documentType: 'receipt' },
    };
    vi.mocked(getFiles).mockResolvedValue(new Map(Object.entries(files)));
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: true, data: { files } });
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-3': { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors, uploadDates: { 'file-1': '2026-11-01T06:30:00Z' } });
    const args = createActionArgs(
      createUploadFormData([
        { id: 'file-1', file: retryFile, documentType: 'receipt' },
        { id: 'file-3', file: newFile, documentType: 'receipt' },
      ]),
    );
    const { session } = args.context.get(appContext);
    args.params = { ...args.params, lang: locale };
    vi.mocked(getLocale).mockReturnValue(locale);

    const result = await action(args);

    expect(updateDocumentUploadState).toHaveBeenNthCalledWith(1, { id: uploadId, session, params: args.params, state: { documents: [retryDocument, uploadedDocument, newDocument] } });
    const documents = [{ ...retryDocument, status: 'uploaded', uploadDate: '2026-11-01T06:30:00Z' }, uploadedDocument, newDocument];
    expect(updateDocumentUploadState).toHaveBeenNthCalledWith(2, { id: uploadId, session, params: args.params, state: { documents } });
    expect(result).toEqual({ data: { formAction: 'upload', source: 'server', responseType: 'upload-errors', errors, documents }, init: { status: 400 }, type: 'DataWithResponseInit' });
    expect(JSON.parse(JSON.stringify(documents))).toEqual(documents);
    expect(documents[2]).not.toHaveProperty('uploadDate');
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(validateUploadedFiles).toHaveBeenCalledWith({ files: expect.any(Map), locale, t: expect.any(Function) });
    expect(finishDocumentUploadState).not.toHaveBeenCalled();
  });

  it('starts submitted state and redirects after all documents are processed', async () => {
    const receipt = new File(['content'], 'document.pdf');
    const identity = new File(['identity content'], 'document.pdf');
    const files = {
      'file-1': { file: receipt, fileBuffer: new ArrayBuffer(receipt.size), fileHash: 'receipt-hash', documentType: 'receipt' },
      'file-2': { file: identity, fileBuffer: new ArrayBuffer(identity.size), fileHash: 'identity-hash', documentType: 'identity-document' },
    } satisfies DocumentUploadSchemaOutput['files'];
    const formData = createUploadFormData([
      { id: 'file-1', file: receipt, documentType: 'receipt' },
      { id: 'file-2', file: identity, documentType: 'identity-document' },
    ]);
    const parsedBatch = new Map(Object.entries(files));
    vi.mocked(getFiles).mockResolvedValue(parsedBatch);
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: true, data: { files } });
    vi.mocked(getLocale).mockReturnValueOnce('fr');
    const args = createActionArgs(formData);
    args.url = new URL(`http://localhost/fr/protected/documents/upload/${uploadId}`);
    args.params = { id: uploadId, lang: 'fr' };
    args.pattern = '/:lang/protected/documents/upload/:id';
    const { session } = args.context.get(appContext);
    const result = await action(args);

    expect(getFiles).toHaveBeenCalledExactlyOnceWith(formData);
    expect(validateUploadedFiles).toHaveBeenCalledExactlyOnceWith({ files: parsedBatch, locale: 'fr', t: expect.any(Function) });
    expect(validateDocumentContents).toHaveBeenCalledExactlyOnceWith(files);
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(updateDocumentUploadState).toHaveBeenCalledWith({
      id: uploadId,
      session,
      params: args.params,
      state: {
        documents: [
          { documentType: 'receipt', fileName: 'document.pdf', fileSize: 7, id: 'file-1', status: 'uploaded', uploadDate: '2026-11-01T06:30:00Z' },
          { documentType: 'identity-document', fileName: 'document.pdf', fileSize: 16, id: 'file-2', status: 'uploaded', uploadDate: '2026-11-01T06:30:01Z' },
        ],
      },
    });
    expect(getDocumentUploadSubmittedUrl).toHaveBeenCalledWith(uploadId, args.params);
    assert(result instanceof Response);
    expect(result.status).toBe(302);
    expect(result.headers.get('Location')).toBe(submittedUrl);
    expect(result.headers.get('X-Remix-Replace')).toBe('true');
  });
});

function attemptAttributes(counts: { attempt: number; outcome: string; submitted: number; uploaded: number; failed: number; total: number }) {
  return {
    'otel.event.name': 'cdcp.document_upload.attempt.completed',
    'cdcp.document_upload.attempt.number': counts.attempt,
    'cdcp.document_upload.attempt.outcome': counts.outcome,
    'cdcp.document_upload.files.submitted_count': counts.submitted,
    'cdcp.document_upload.files.uploaded_count': counts.uploaded,
    'cdcp.document_upload.files.failed_count': counts.failed,
    'cdcp.document_upload.flow.id': uploadId,
    'cdcp.document_upload.flow.uploaded_total': counts.total,
    'session.id': 'session-1',
  };
}

function flowFinishedAttributes(attemptCount: number, total: number) {
  return {
    'otel.event.name': 'cdcp.document_upload.flow.finished',
    'cdcp.document_upload.flow.attempt_count': attemptCount,
    'cdcp.document_upload.flow.id': uploadId,
    'cdcp.document_upload.flow.uploaded_total': total,
    'session.id': 'session-1',
  };
}

describe('upload telemetry', () => {
  const logger = mock<Logger>();

  beforeEach(() => {
    vi.mocked(createLogger).mockReturnValue(logger);
    vi.mocked(recordDocumentUploadAttempt).mockReturnValue(1);
  });

  it('logs the attempt and the finished flow when every file uploads', async () => {
    const args = createActionArgs(validUploadFormData());
    const { session } = args.context.get(appContext);

    await action(args);

    expect(recordDocumentUploadAttempt).toHaveBeenCalledExactlyOnceWith({ id: uploadId, session, params: args.params });
    expect(logger.info).toHaveBeenCalledWith('Document upload attempt completed', attemptAttributes({ attempt: 1, outcome: 'uploaded', submitted: 1, uploaded: 1, failed: 0, total: 1 }));
    expect(logger.info).toHaveBeenCalledWith('Document upload flow finished', flowFinishedAttributes(1, 1));
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs a warning with per-attempt and flow counts when a retry partly fails', async () => {
    vi.mocked(recordDocumentUploadAttempt).mockReturnValue(2);
    const uploadedDocument = { id: 'file-2', fileName: 'uploaded.pdf', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const, uploadDate: '2026-11-01T05:30:00Z' };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument], uploadAttemptCount: 1 });
    const retryFile = new File(['retry'], 'retry.pdf');
    const newFile = new File(['new'], 'new.pdf');
    const files = {
      'file-1': { file: retryFile, fileBuffer: new ArrayBuffer(retryFile.size), fileHash: 'retry-hash', documentType: 'receipt' },
      'file-3': { file: newFile, fileBuffer: new ArrayBuffer(newFile.size), fileHash: 'new-hash', documentType: 'receipt' },
    };
    vi.mocked(getFiles).mockResolvedValue(new Map(Object.entries(files)));
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: true, data: { files } });
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-3': { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors, uploadDates: { 'file-1': '2026-11-01T06:30:00Z' } });
    const args = createActionArgs(
      createUploadFormData([
        { id: 'file-1', file: retryFile, documentType: 'receipt' },
        { id: 'file-3', file: newFile, documentType: 'receipt' },
      ]),
    );

    await action(args);

    expect(logger.warn).toHaveBeenCalledExactlyOnceWith('Document upload attempt completed with failed files', attemptAttributes({ attempt: 2, outcome: 'upload_failed', submitted: 2, uploaded: 1, failed: 1, total: 2 }));
    expect(logger.info).not.toHaveBeenCalledWith('Document upload flow finished', expect.anything());
  });

  it('does not log or count a submission that fails form validation', async () => {
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: false, errors: { errors: [] } });

    await action(createActionArgs(validUploadFormData()));

    expect(recordDocumentUploadAttempt).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not log or count a submission that fails content validation', async () => {
    vi.mocked(validateDocumentContents).mockResolvedValue({ success: false, errors: { errors: [] } });

    await action(createActionArgs(validUploadFormData()));

    expect(recordDocumentUploadAttempt).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('does not count a malformed request as an attempt', async () => {
    const formData = new FormData();
    formData.set('_action', 'upload');

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 400 } });
    expect(recordDocumentUploadAttempt).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('logs the finished flow with the recorded attempt count on an explicit finish', async () => {
    const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', documentType: 'receipt', fileSize: 8, status: 'uploaded' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [uploadedDocument, { ...uploadedDocument, id: 'pending', status: 'pending' }], uploadAttemptCount: 3 });
    const formData = new FormData();
    formData.set('_action', 'finish');

    await action(createActionArgs(formData));

    expect(recordDocumentUploadAttempt).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledExactlyOnceWith('Document upload flow finished', flowFinishedAttributes(3, 1));
  });
});
