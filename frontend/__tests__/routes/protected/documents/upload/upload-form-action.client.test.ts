import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { getDocumentUploadSubmittedUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFiles, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { clientAction } from '~/routes/protected/documents/upload/upload-form-action.client';
import { getLanguage } from '~/utils/locale-utils';

vi.mock(import('node:crypto'));
vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'));
vi.mock(import('~/.server/utils/locale-utils'));
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

type ClientActionArgs = Parameters<typeof clientAction>[0];

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
  vi.mocked(getLanguage).mockReturnValue('en');
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(startDocumentUploadState).mockReturnValue({ id: 'upload-id', status: 'initialized', documents: [] });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('clientAction', () => {
  it('delegates finish directly to the server without parsing or validating files', async () => {
    const formData = new FormData();
    formData.set('_action', 'finish');
    const serverAction = vi.fn().mockResolvedValue({ submitted: true });

    await expect(clientAction(mock<ClientActionArgs>({ request: createRequest(formData), url: new URL('http://localhost/en/protected/documents/upload/session-1'), serverAction }))).resolves.toEqual({ submitted: true });
    expect(serverAction).toHaveBeenCalledOnce();
    expect(getFiles).not.toHaveBeenCalled();
    expect(validateUploadedFiles).not.toHaveBeenCalled();
  });

  it('returns tagged errors for invalid upload data without calling the server action', async () => {
    const { validateUploadedFiles: validateUploadedFilesActual } = await vi.importActual<{ validateUploadedFiles: typeof validateUploadedFiles }>('~/route-helpers/protected-documents-upload-helpers');
    const filesWithoutDocumentType: Awaited<ReturnType<typeof getFiles>> = new Map([['file-1', { file: new File(['content'], 'document.pdf'), fileBuffer: new ArrayBuffer(7), fileHash: 'file-hash', documentType: '' }]]);
    vi.mocked(getFiles).mockResolvedValue(filesWithoutDocumentType);
    vi.mocked(validateUploadedFiles).mockImplementation(validateUploadedFilesActual);
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
                      errors: [expect.anything()],
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
