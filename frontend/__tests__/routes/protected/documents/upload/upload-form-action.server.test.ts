import { RouterContextProvider } from 'react-router';

import { afterEach, assert, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { finishDocumentUploadState, getDocumentUploadStateIdFromUrl, getDocumentUploadSubmittedUrl, loadDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
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
const uploadErrors: DocumentUploadSchemaErrorTree = {
  errors: [],
  properties: {
    files: {
      errors: [],
      properties: {
        'file-1': {
          errors: [],
          properties: { documentType: { errors: ['document type required'] } },
        },
      },
    },
  },
};

function createSelectionFormData(files: ReadonlyArray<File>, currentFileCount = 0) {
  const formData = new FormData();
  formData.set('_action', 'add-files');
  formData.set('_validation_id', 'validation-1');
  formData.set('current_file_count', String(currentFileCount));
  for (const file of files) formData.append('file_object', file, file.name);
  return formData;
}

function createUploadFormData(entries: ReadonlyArray<{ id: string; file: File; documentType?: string }>) {
  const formData = new FormData();
  formData.set('_action', 'upload');
  for (const { id, file, documentType } of entries) {
    formData.append('file_id', id);
    formData.append('file_object', file, file.name);
    if (documentType !== undefined) formData.append('file_document_type', documentType);
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
  vi.mocked(validateFileSelection).mockResolvedValue({ success: true, validationId: 'validation-1', errors: undefined });
  vi.mocked(getFiles).mockResolvedValue(parsedFiles);
  vi.mocked(validateUploadedFiles).mockReturnValue({
    success: true,
    data: { files: Object.fromEntries(parsedFiles) },
  });
  vi.mocked(getDocumentUploadStateIdFromUrl).mockReturnValue(uploadId);
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(getLanguage).mockReturnValue('en');
  vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'initialized', documents: [] });
  vi.mocked(scanDocuments).mockResolvedValue({ success: true });
  vi.mocked(updateDocumentUploadState).mockReturnValue({ id: uploadId, status: 'initialized', documents: [] });
  vi.mocked(uploadDocuments).mockResolvedValue({ success: true });
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
    expect(scanDocuments).not.toHaveBeenCalled();
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

  it('rejects the client-only file validation action', async () => {
    const args = createActionArgs(createSelectionFormData([]));

    await expect(action(args)).rejects.toThrow('Invalid formAction: add-files');
  });

  it.each(['empty batch', 'missing file', 'missing ID', 'text instead of a file'])('rejects an upload with $0 before changing state', async (caseName) => {
    const formData = new FormData();
    formData.set('_action', 'upload');
    if (caseName !== 'empty batch' && caseName !== 'missing ID') formData.set('file_id', 'file-1');
    if (caseName === 'missing ID') formData.set('file_object', new File(['content'], 'document.pdf'));
    if (caseName === 'text instead of a file') formData.set('file_object', 'document.pdf');

    await expect(action(createActionArgs(formData))).rejects.toMatchObject({ init: { status: 400 } });
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(updateDocumentUploadState).not.toHaveBeenCalled();
    expect(scanDocuments).not.toHaveBeenCalled();
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

  it('returns validation errors without scanning invalid upload data', async () => {
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: false, errors: uploadErrors });
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
                      errors: ['document type required'],
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
    expect(scanDocuments).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('replaces stale pending metadata with the submitted batch even when scanning fails', async () => {
    const args = createActionArgs(validUploadFormData());
    const { session } = args.context.get(appContext);
    const uploadedDocument = { id: 'uploaded', fileName: 'uploaded.txt', documentType: 'receipt', fileSize: 8, status: 'uploaded' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [{ id: 'removed-file', fileName: 'removed.pdf', documentType: 'receipt', fileSize: 7, status: 'pending' }, uploadedDocument] });
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: ['scan failed'] } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(scanDocuments).mockResolvedValue({ success: false, errors });

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
                  errors: ['scan failed'],
                },
              },
            },
          },
        },
        formAction: 'upload',
        source: 'server',
        responseType: 'scan-errors',
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
    expect(vi.mocked(updateDocumentUploadState).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(scanDocuments).mock.invocationCallOrder[0]!);
  });

  it('returns upload errors without starting submitted state', async () => {
    const args = createActionArgs(validUploadFormData());
    const { session } = args.context.get(appContext);
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors });

    const result = await action(args);

    expect(loadDocumentUploadState).toHaveBeenCalledWith({ id: args.params.id, session, params: args.params });
    expect(scanDocuments).toHaveBeenCalledOnce();
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

  it('preserves order across a partial retry, retaining uploaded documents and replacing pending metadata', async () => {
    const retryFile = new File(['retry'], 'retry.pdf');
    const newFile = new File(['new'], 'new.pdf');
    const retryDocument = { id: 'file-1', fileName: retryFile.name, fileSize: retryFile.size, documentType: 'receipt', status: 'pending' as const };
    const uploadedDocument = { id: 'file-2', fileName: 'uploaded.pdf', fileSize: 8, documentType: 'receipt', status: 'uploaded' as const };
    const newDocument = { id: 'file-3', fileName: newFile.name, fileSize: newFile.size, documentType: 'receipt', status: 'pending' as const };
    vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, status: 'partial-upload', documents: [retryDocument, uploadedDocument, { ...retryDocument, id: 'removed' }] });
    const files = {
      'file-1': { file: retryFile, fileBuffer: new ArrayBuffer(retryFile.size), fileHash: 'retry-hash', documentType: 'receipt' },
      'file-3': { file: newFile, fileBuffer: new ArrayBuffer(newFile.size), fileHash: 'new-hash', documentType: 'receipt' },
    };
    vi.mocked(getFiles).mockResolvedValue(new Map(Object.entries(files)));
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: true, data: { files } });
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-3': { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors });
    const args = createActionArgs(
      createUploadFormData([
        { id: 'file-1', file: retryFile, documentType: 'receipt' },
        { id: 'file-3', file: newFile, documentType: 'receipt' },
      ]),
    );
    const { session } = args.context.get(appContext);

    const result = await action(args);

    expect(updateDocumentUploadState).toHaveBeenNthCalledWith(1, { id: uploadId, session, params: args.params, state: { documents: [retryDocument, uploadedDocument, newDocument] } });
    const documents = [{ ...retryDocument, status: 'uploaded' }, uploadedDocument, newDocument];
    expect(updateDocumentUploadState).toHaveBeenNthCalledWith(2, { id: uploadId, session, params: args.params, state: { documents } });
    expect(result).toEqual({ data: { formAction: 'upload', source: 'server', responseType: 'upload-errors', errors, documents }, init: { status: 400 }, type: 'DataWithResponseInit' });
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith(files);
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
    expect(scanDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(updateDocumentUploadState).toHaveBeenCalledWith({
      id: uploadId,
      session,
      params: args.params,
      state: {
        documents: [
          { documentType: 'receipt', fileName: 'document.pdf', fileSize: 7, id: 'file-1', status: 'uploaded' },
          { documentType: 'identity-document', fileName: 'document.pdf', fileSize: 16, id: 'file-2', status: 'uploaded' },
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
