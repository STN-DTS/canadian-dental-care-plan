import { RouterContextProvider } from 'react-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { getDocumentUploadSubmittedUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { action, clientAction } from '~/routes/protected/documents/upload';
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
  formData.set('_action', 'validate-files');
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
type ClientActionArgs = Parameters<typeof clientAction>[0];

function createActionArgs(formData: FormData): ActionArgs {
  const session = mock<Session>({ id: 'session-1' });
  const context = new RouterContextProvider();
  context.set(appContext, mock<AppContext>({ session }));
  return {
    request: createRequest(formData),
    url: new URL('http://localhost/en/protected/documents/upload'),
    context,
    params: { lang: 'en' },
    pattern: '/en/protected/documents/upload',
  };
}

const validUploadFormData = () => createUploadFormData([{ id: 'file-1', file: new File(['content'], 'document.pdf'), documentType: 'receipt' }]);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValue(uploadId) });
  vi.mocked(validateFileSelection).mockReturnValue({ success: true, validationId: 'validation-1', errors: undefined });
  vi.mocked(validateUploadForm).mockResolvedValue({
    success: true,
    data: {
      files: {
        'file-1': {
          file: new File(['content'], 'document.pdf'),
          fileBuffer: new ArrayBuffer(7),
          fileHash: 'file-hash',
          documentType: 'receipt',
        },
      },
    },
  });
  vi.mocked(getLanguage).mockReturnValue('en');
  vi.mocked(scanDocuments).mockResolvedValue({ success: true });
  vi.mocked(uploadDocuments).mockResolvedValue({ success: true });
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(startDocumentUploadState).mockReturnValue({ id: 'upload-id', submittedDocuments: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientAction', () => {
  it('returns tagged errors for invalid file selection without calling the server action', async () => {
    vi.mocked(validateFileSelection).mockReturnValue({
      success: false,
      validationId: 'validation-1',
      errors: { errors: [], properties: { files: { errors: ['invalid file type'] } } },
    });
    const serverAction = vi.fn();
    const result = await clientAction(
      mock<ClientActionArgs>({
        request: createRequest(createSelectionFormData([new File(['content'], 'document.exe')])),
        url: new URL('http://localhost/en/protected/documents/upload'),
        serverAction,
      }),
    );

    expect(serverAction).not.toHaveBeenCalled();
    expect(result).toEqual({
      data: {
        errors: {
          errors: [],
          properties: {
            files: {
              errors: ['invalid file type'],
            },
          },
        },
        formAction: 'validate-files',
        source: 'client',
        validationId: 'validation-1',
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
  });

  it('returns a tagged selection success without calling the server action', async () => {
    const serverAction = vi.fn();
    const formData = createSelectionFormData([new File(['content'], 'document.pdf')]);
    vi.mocked(getLanguage).mockReturnValue('fr');
    const result = await clientAction(
      mock<ClientActionArgs>({
        request: createRequest(formData),
        url: new URL('http://localhost/fr/protected/documents/upload'),
        serverAction,
      }),
    );

    expect(validateFileSelection).toHaveBeenCalledExactlyOnceWith({ formData, locale: 'fr', t: expect.any(Function) });
    expect(result).toEqual({ formAction: 'validate-files', source: 'client', validationId: 'validation-1', errors: undefined });
    expect(serverAction).not.toHaveBeenCalled();
  });

  it('returns tagged errors for invalid upload data without calling the server action', async () => {
    vi.mocked(validateUploadForm).mockResolvedValue({ success: false, errors: uploadErrors });
    const serverAction = vi.fn();
    const formData = createUploadFormData([{ id: 'file-1', file: new File(['content'], 'document.pdf') }]);
    const result = await clientAction(
      mock<ClientActionArgs>({
        request: createRequest(formData),
        url: new URL('http://localhost/en/protected/documents/upload'),
        serverAction,
      }),
    );

    expect(serverAction).not.toHaveBeenCalled();
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
        source: 'client',
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
  });

  it('delegates valid upload data to the server action', async () => {
    const serverAction = vi.fn().mockResolvedValue({ submitted: true });
    const formData = validUploadFormData();
    vi.mocked(getLanguage).mockReturnValue('fr');

    await expect(
      clientAction(
        mock<ClientActionArgs>({
          request: createRequest(formData),
          url: new URL('http://localhost/fr/protected/documents/upload'),
          serverAction,
        }),
      ),
    ).resolves.toEqual({ submitted: true });
    expect(validateUploadForm).toHaveBeenCalledExactlyOnceWith({ formData, locale: 'fr', t: expect.any(Function) });
    expect(serverAction).toHaveBeenCalledOnce();
  });
});

describe('action', () => {
  it('rejects the client-only file validation action', async () => {
    const args = createActionArgs(createSelectionFormData([]));

    await expect(action(args)).rejects.toThrow('Invalid formAction: validate-files');
  });

  it('returns validation errors without scanning invalid upload data', async () => {
    vi.mocked(validateUploadForm).mockResolvedValue({ success: false, errors: uploadErrors });
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
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(scanDocuments).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
  });

  it('returns scan errors without uploading documents', async () => {
    const args = createActionArgs(validUploadFormData());
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
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(startDocumentUploadState).not.toHaveBeenCalled();
  });

  it('returns upload errors without starting submitted state', async () => {
    const args = createActionArgs(validUploadFormData());
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: ['upload failed'] } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, errors });

    const result = await action(args);

    expect(scanDocuments).toHaveBeenCalledOnce();
    expect(result).toEqual({
      data: {
        errors: {
          errors: [],
          properties: {
            files: {
              errors: [],
              properties: {
                'file-1': {
                  errors: ['upload failed'],
                },
              },
            },
          },
        },
        formAction: 'upload',
        source: 'server',
      },
      init: {
        status: 400,
      },
      type: 'DataWithResponseInit',
    });
    expect(startDocumentUploadState).not.toHaveBeenCalled();
  });

  it('starts submitted state and redirects after all documents are processed', async () => {
    const receipt = new File(['content'], 'document.pdf');
    const identity = new File(['identity content'], 'identity.txt');
    const files = {
      'file-1': { file: receipt, fileBuffer: new ArrayBuffer(receipt.size), fileHash: 'receipt-hash', documentType: 'receipt' },
      'file-2': { file: identity, fileBuffer: new ArrayBuffer(identity.size), fileHash: 'identity-hash', documentType: 'identity-document' },
    } satisfies DocumentUploadSchemaOutput['files'];
    const formData = createUploadFormData([
      { id: 'file-1', file: receipt, documentType: 'receipt' },
      { id: 'file-2', file: identity, documentType: 'identity-document' },
    ]);
    vi.mocked(validateUploadForm).mockResolvedValue({ success: true, data: { files } });
    vi.mocked(getLocale).mockReturnValueOnce('fr');
    const args = createActionArgs(formData);
    args.url = new URL('http://localhost/fr/protected/documents/upload');
    args.params = { lang: 'fr' };
    args.pattern = '/fr/protected/documents/upload';
    const { session } = args.context.get(appContext);
    const result = await action(args);

    expect(validateUploadForm).toHaveBeenCalledExactlyOnceWith({ formData, locale: 'fr', t: expect.any(Function) });
    expect(scanDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith(files);
    expect(startDocumentUploadState).toHaveBeenCalledWith({
      id: uploadId,
      session,
      submittedDocuments: [
        { fileName: 'document.pdf', documentType: 'receipt', fileSize: 7 },
        { fileName: 'identity.txt', documentType: 'identity-document', fileSize: 16 },
      ],
    });
    expect(getDocumentUploadSubmittedUrl).toHaveBeenCalledWith({ id: uploadId, params: { lang: 'fr' } });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe(submittedUrl);
  });
});
