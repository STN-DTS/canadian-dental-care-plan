import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { getDocumentUploadSubmittedUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { clientAction } from '~/routes/protected/documents/upload/upload-form-action.client';
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

type ClientActionArgs = Parameters<typeof clientAction>[0];

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
  vi.mocked(getLanguage).mockReturnValue('en');
  vi.mocked(scanDocuments).mockResolvedValue({ success: true });
  vi.mocked(uploadDocuments).mockResolvedValue({ success: true });
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(startDocumentUploadState).mockReturnValue({ id: 'upload-id', status: 'initialized', pendingDocuments: [], uploadedDocuments: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientAction', () => {
  it('returns tagged errors for invalid file selection without calling the server action', async () => {
    vi.mocked(validateFileSelection).mockResolvedValue({
      success: false,
      validationId: 'validation-1',
      errors: { errors: [], properties: { files: { errors: ['invalid file type'] } } },
    });
    const serverAction = vi.fn();
    const result = await clientAction(
      mock<ClientActionArgs>({
        request: createRequest(createSelectionFormData([new File(['content'], 'document.exe')])),
        url: new URL('http://localhost/en/protected/documents/upload/session-1'),
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
        formAction: 'add-files',
        responseType: 'validation-errors',
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
        url: new URL('http://localhost/fr/protected/documents/upload/session-1'),
        serverAction,
      }),
    );

    expect(validateFileSelection).toHaveBeenCalledExactlyOnceWith({ formData, locale: 'fr', t: expect.any(Function) });
    expect(result).toEqual({
      formAction: 'add-files',
      responseType: 'success',
      source: 'client',
      validationId: 'validation-1',
      errors: undefined,
    });
    expect(serverAction).not.toHaveBeenCalled();
  });

  it('delegates finish directly to the server without parsing or validating files', async () => {
    const formData = new FormData();
    formData.set('_action', 'finish');
    const serverAction = vi.fn().mockResolvedValue({ submitted: true });

    await expect(clientAction(mock<ClientActionArgs>({ request: createRequest(formData), url: new URL('http://localhost/en/protected/documents/upload/session-1'), serverAction }))).resolves.toEqual({ submitted: true });
    expect(serverAction).toHaveBeenCalledOnce();
    expect(getFiles).not.toHaveBeenCalled();
    expect(validateUploadedFiles).not.toHaveBeenCalled();
    expect(validateFileSelection).not.toHaveBeenCalled();
  });

  it('returns tagged errors for invalid upload data without calling the server action', async () => {
    vi.mocked(validateUploadedFiles).mockReturnValue({ success: false, errors: uploadErrors });
    const serverAction = vi.fn();
    const formData = createUploadFormData([{ id: 'file-1', file: new File(['content'], 'document.pdf') }]);
    const result = await clientAction(
      mock<ClientActionArgs>({
        request: createRequest(formData),
        url: new URL('http://localhost/en/protected/documents/upload/session-1'),
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
        responseType: 'validation-errors',
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
          url: new URL('http://localhost/fr/protected/documents/upload/session-1'),
          serverAction,
        }),
      ),
    ).resolves.toEqual({ submitted: true });
    expect(getFiles).toHaveBeenCalledExactlyOnceWith(formData);
    expect(validateUploadedFiles).toHaveBeenCalledExactlyOnceWith({ files: parsedFiles, locale: 'fr', t: expect.any(Function) });
    expect(serverAction).toHaveBeenCalledOnce();
  });
});
