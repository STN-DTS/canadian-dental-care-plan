import { createElement, useState } from 'react';
import type { ComponentProps, ComponentType } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import { RouterContextProvider, createRoutesStub, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { appContext } from '~/.server/context';
import type { AppContext } from '~/.server/context';
import { addSubmittedDocuments, getDocumentUploadSubmittedUrl, loadDocumentUploadState, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { ClientEnvProvider } from '~/components/client-env-context';
import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import DocumentsUpload, { action, clientAction } from '~/routes/protected/documents/upload';
import { clientEnvSchema } from '~/utils/env-utils';
import { getLanguage } from '~/utils/locale-utils';

vi.mock(import('node:crypto'));
vi.mock(import('react-router'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useFetcher: vi.fn() };
});
vi.mock(import('~/components/csrf-token-input'), () => ({ CsrfTokenInput: () => createElement('input', { type: 'hidden' }) }));
vi.mock(import('~/.server/routes/helpers/document-upload-route-helpers'));
vi.mock(import('~/.server/utils/locale-utils'));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers.server'));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers'));
vi.mock(import('~/utils/locale-utils'));

const uploadLoaderData = {
  meta: { title: 'Submit documents' },
  documentTypes: [{ id: 'receipt', name: 'Receipt' }],
  SCCH_BASE_URI: 'https://example.test',
};
const DocumentsUploadForTest = DocumentsUpload as unknown as ComponentType<{ loaderData: typeof uploadLoaderData }>;

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
  vi.mocked(scanDocuments).mockResolvedValue({ success: true, scannedFileIds: ['file-1'] });
  vi.mocked(uploadDocuments).mockResolvedValue({ success: true, uploadedFileIds: ['file-1'] });
  vi.mocked(getDocumentUploadSubmittedUrl).mockReturnValue(submittedUrl);
  vi.mocked(startDocumentUploadState).mockReturnValue({ id: 'upload-id', submittedDocuments: [] });
  vi.mocked(loadDocumentUploadState).mockReturnValue({ id: uploadId, submittedDocuments: [] });
  vi.mocked(addSubmittedDocuments).mockReturnValue({ id: uploadId, submittedDocuments: [] });
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
    vi.mocked(scanDocuments).mockResolvedValue({ success: false, scannedFileIds: [], errors });

    const result = await action(args);

    expect(result).toMatchObject({
      data: {
        errors,
        formAction: 'upload',
        source: 'server',
        flowId: uploadId,
        uploadedFileIds: [],
      },
    });
    expect(uploadDocuments).not.toHaveBeenCalled();
    expect(startDocumentUploadState).toHaveBeenCalledWith({ id: uploadId, session: expect.anything(), submittedDocuments: [] });
  });

  it('returns upload errors and starts metadata-only recovery state', async () => {
    const args = createActionArgs(validUploadFormData());
    const errors = { errors: [], properties: { files: { errors: [], properties: { 'file-1': { errors: ['upload failed'] } } } } } satisfies DocumentUploadSchemaErrorTree;
    vi.mocked(uploadDocuments).mockResolvedValue({ success: false, uploadedFileIds: [], errors });

    const result = await action(args);

    expect(scanDocuments).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      data: {
        errors,
        formAction: 'upload',
        source: 'server',
        flowId: uploadId,
        uploadedFileIds: [],
      },
    });
    expect(startDocumentUploadState).toHaveBeenCalledWith({ id: uploadId, session: expect.anything(), submittedDocuments: [] });
    expect(JSON.stringify(result)).not.toContain('content');
  });

  it('returns mixed results with only confirmed filenames persisted', async () => {
    const passed = new File(['safe file bytes'], 'confirmed.pdf');
    const failed = new File(['private file bytes'], 'rejected.pdf');
    const files = {
      'file-1': { file: passed, fileBuffer: new ArrayBuffer(passed.size), fileHash: 'hash-1', documentType: 'receipt' },
      'file-2': { file: failed, fileBuffer: new ArrayBuffer(failed.size), fileHash: 'hash-2', documentType: 'identity-document' },
    } satisfies DocumentUploadSchemaOutput['files'];
    vi.mocked(validateUploadForm).mockResolvedValue({ success: true, data: { files } });
    vi.mocked(scanDocuments).mockResolvedValue({
      success: false,
      scannedFileIds: ['file-1'],
      errors: { errors: [], properties: { files: { errors: [], properties: { 'file-2': { errors: ['scan failed'] } } } } },
    });
    vi.mocked(uploadDocuments).mockResolvedValue({ success: true, uploadedFileIds: ['file-1'] });
    const args = createActionArgs(
      createUploadFormData([
        { id: 'file-1', file: passed, documentType: 'receipt' },
        { id: 'file-2', file: failed, documentType: 'identity-document' },
      ]),
    );

    const result = await action(args);

    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith({ 'file-1': files['file-1'] });
    expect(startDocumentUploadState).toHaveBeenCalledWith({
      id: uploadId,
      session: args.context.get(appContext).session,
      submittedDocuments: [{ id: 'file-1', fileName: 'confirmed.pdf', documentType: 'receipt', fileSize: passed.size }],
    });
    expect(result).toMatchObject({
      data: { flowId: uploadId, uploadedFileIds: ['file-1'], errors: expect.any(Object) },
    });
    expect(JSON.stringify(result)).not.toContain('safe file bytes');
    expect(JSON.stringify(result)).not.toContain('private file bytes');
  });

  it('never retries a session-confirmed file and records newly confirmed metadata', async () => {
    const confirmed = new File(['content'], 'already-uploaded.pdf');
    const retry = new File(['content'], 'retry.pdf');
    const files = {
      'file-1': { file: confirmed, fileBuffer: new ArrayBuffer(confirmed.size), fileHash: 'hash-1', documentType: 'receipt' },
      'file-2': { file: retry, fileBuffer: new ArrayBuffer(retry.size), fileHash: 'hash-2', documentType: 'receipt' },
    } satisfies DocumentUploadSchemaOutput['files'];
    const formData = createUploadFormData([
      { id: 'file-1', file: confirmed, documentType: 'receipt' },
      { id: 'file-2', file: retry, documentType: 'receipt' },
    ]);
    formData.set('flow_id', uploadId);
    vi.mocked(validateUploadForm).mockResolvedValue({ success: true, data: { files } });
    vi.mocked(loadDocumentUploadState).mockReturnValue({
      id: uploadId,
      submittedDocuments: [{ id: 'file-1', fileName: confirmed.name, documentType: 'receipt', fileSize: confirmed.size }],
    });
    vi.mocked(scanDocuments).mockResolvedValue({ success: true, scannedFileIds: ['file-2'] });
    vi.mocked(uploadDocuments).mockResolvedValue({ success: true, uploadedFileIds: ['file-2'] });
    const args = createActionArgs(formData);

    const result = await action(args);

    expect(scanDocuments).toHaveBeenCalledExactlyOnceWith({ 'file-2': files['file-2'] });
    expect(uploadDocuments).toHaveBeenCalledExactlyOnceWith({ 'file-2': files['file-2'] });
    expect(addSubmittedDocuments).toHaveBeenCalledWith({
      id: uploadId,
      params: args.params,
      session: args.context.get(appContext).session,
      submittedDocuments: [{ id: 'file-2', fileName: 'retry.pdf', documentType: 'receipt', fileSize: retry.size }],
    });
    expect(result).toMatchObject({ data: { flowId: uploadId, uploadedFileIds: ['file-2'] } });
    expect(result).not.toBeInstanceOf(Response);
  });

  it('requires Finish to redirect a recovery flow with confirmed documents', async () => {
    const formData = new FormData();
    formData.set('_action', 'finish');
    formData.set('flow_id', uploadId);
    const args = createActionArgs(formData);
    vi.mocked(loadDocumentUploadState).mockReturnValue({
      id: uploadId,
      submittedDocuments: [{ id: 'file-1', fileName: 'confirmed.pdf', documentType: 'receipt', fileSize: 7 }],
    });

    const result = await action(args);

    expect(result).toBeInstanceOf(Response);
    expect((result as Response).headers.get('Location')).toBe(submittedUrl);
    expect(scanDocuments).not.toHaveBeenCalled();
    expect(uploadDocuments).not.toHaveBeenCalled();
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
    vi.mocked(validateUploadForm).mockResolvedValue({ success: true, data: { files } });
    vi.mocked(scanDocuments).mockResolvedValue({ success: true, scannedFileIds: ['file-1', 'file-2'] });
    vi.mocked(uploadDocuments).mockResolvedValue({ success: true, uploadedFileIds: ['file-1', 'file-2'] });
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
        { id: 'file-1', fileName: 'document.pdf', documentType: 'receipt', fileSize: 7 },
        { id: 'file-2', fileName: 'document.pdf', documentType: 'identity-document', fileSize: 16 },
      ],
    });
    expect(getDocumentUploadSubmittedUrl).toHaveBeenCalledWith({ id: uploadId, params: { lang: 'fr' } });
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
    expect((result as Response).headers.get('Location')).toBe(submittedUrl);
  });
});

describe('DocumentsUpload recovery UI', () => {
  it('keeps confirmed files locked, retries only failures, and requires Finish', async () => {
    const submissions: FormData[] = [];
    const submitHandler = (formData: FormData) => {
      submissions.push(formData);
      const formAction = formData.get('_action');
      if (formAction === 'validate-files') {
        return { formAction, source: 'client', validationId: formData.get('_validation_id'), errors: undefined };
      }
      if (formAction === 'finish') return null;

      const fileIds = formData.getAll('file_id') as string[];
      const flowId = (formData.get('flow_id') as string | null) ?? 'recovery-flow';
      if (!formData.has('flow_id')) {
        return {
          formAction: 'upload',
          source: 'server',
          flowId,
          uploadedFileIds: fileIds.slice(0, 1),
          errors: {
            errors: [],
            properties: {
              files: {
                errors: [],
                properties: {
                  [fileIds[1] ?? 'missing-file']: { errors: [], properties: { file: { errors: ['upload failed'] } } },
                },
              },
            },
          },
        };
      }

      return { formAction: 'upload', source: 'server', flowId, uploadedFileIds: fileIds, errors: undefined };
    };
    const routes = createRoutesStub([
      {
        path: '/',
        Component: () => createElement(DocumentsUploadForTest, { loaderData: uploadLoaderData }),
      },
    ]);

    renderRecoveryUi(routes, submitHandler);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload file' })).toBeEnabled());

    await addFile(new File(['one'], 'confirmed.pdf'));
    await addFile(new File(['two'], 'retry.pdf'));
    const confirmedItem = screen.getByText('confirmed.pdf').closest('[role="listitem"]') as HTMLElement;
    const retryItem = screen.getByText('retry.pdf').closest('[role="listitem"]') as HTMLElement;
    fireEvent.change(confirmedItem.querySelector('select') as HTMLSelectElement, { target: { value: 'receipt' } });
    fireEvent.change(retryItem.querySelector('select') as HTMLSelectElement, { target: { value: 'receipt' } });

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(await screen.findByText('Uploaded')).toBeInTheDocument();
    expect(screen.getByText('Not uploaded')).toBeInTheDocument();
    const failedElement = screen.getByText('retry.pdf').closest('[role="listitem"]') as HTMLElement;
    expect(failedElement.querySelector('[role="alert"]')).toHaveTextContent('upload failed');
    expect(screen.getByRole('button', { name: 'Submit remaining files' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();

    const uploadedElement = screen.getByText('confirmed.pdf').closest('[role="listitem"]') as HTMLElement;
    const failedItemId = failedElement.id.replace('file-upload-item-', '');
    expect(failedElement).toHaveAttribute('aria-describedby', `file-error-${failedItemId}`);
    expect(document.getElementById('upload-recovery-summary')).toHaveAttribute('aria-live', 'polite');
    expect(uploadedElement).toHaveTextContent('Receipt');
    expect(uploadedElement.querySelector('button[data-slot="file-upload-item-delete"]')).toBeNull();
    expect(uploadedElement.querySelector('select')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Submit remaining files' }));
    await waitFor(() => expect(submissions.filter((formData) => formData.get('_action') === 'upload')).toHaveLength(2));
    const retryRequest = submissions.filter((formData) => formData.get('_action') === 'upload')[1];
    if (!retryRequest) throw new Error('Expected retry request');
    expect(retryRequest.getAll('file_id')).toHaveLength(1);
    expect(retryRequest.getAll('file_object').map((file) => (file as File).name)).toEqual(['retry.pdf']);
    expect(await screen.findByRole('button', { name: 'Finish' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await waitFor(() => expect(submissions.at(-1)?.get('_action')).toBe('finish'));
    expect(submissions.at(-1)?.get('flow_id')).toBe('recovery-flow');
  });

  it('allows removing all failures and adding another validated file without showing Finish', async () => {
    const submitHandler = (formData: FormData) => {
      if (formData.get('_action') === 'validate-files') {
        return { formAction: 'validate-files', source: 'client', validationId: formData.get('_validation_id'), errors: undefined };
      }
      const fileId = formData.get('file_id') as string;
      return {
        formAction: 'upload',
        source: 'server',
        flowId: 'empty-recovery',
        uploadedFileIds: [],
        errors: { errors: [], properties: { files: { errors: [], properties: { [fileId]: { errors: [], properties: { file: { errors: ['upload failed'] } } } } } } },
      };
    };
    const routes = createRoutesStub([
      {
        path: '/',
        Component: () => createElement(DocumentsUploadForTest, { loaderData: uploadLoaderData }),
      },
    ]);

    renderRecoveryUi(routes, submitHandler);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Upload file' })).toBeEnabled());
    await addFile(new File(['one'], 'failed.pdf'));
    const failedItem = screen.getByText('failed.pdf').closest('[role="listitem"]') as HTMLElement;
    fireEvent.change(failedItem.querySelector('select') as HTMLSelectElement, { target: { value: 'receipt' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await screen.findByRole('button', { name: 'Submit remaining files' });
    fireEvent.click(document.querySelector('button[data-slot="file-upload-item-delete"]') as HTMLButtonElement);

    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit remaining files' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upload file' })).toBeEnabled();
    await addFile(new File(['new'], 'new.pdf'));
    expect(await screen.findByText('new.pdf')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Finish' })).not.toBeInTheDocument();
  });
});

function renderRecoveryUi(routes: ReturnType<typeof createRoutesStub>, submitHandler: (formData: FormData) => unknown) {
  let nextId = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `ui-file-${++nextId}` });
  const translations = (selector: (value: never) => unknown) =>
    String(
      selector({
        upload: {
          pageTitle: 'Submit documents',
          intro: '',
          chooseDocuments: {
            title: 'Choose your documents',
            canUpload: '',
            eligibilityFormHref: '',
            list: { eligibilityForm: '', letter: '', proof: '' },
            mustInclude: '',
            mustIncludeList: { name: '', memberId: '', signature: '' },
          },
          uploadFiles: {
            title: 'Upload your files',
            chooseFile: 'Choose a file to upload.',
            maxFiles: 'Upload up to {{count}} files',
            maxSize: 'File limit {{filesize}}',
            acceptedTypes: 'Accepted types: {{extensions}}',
            filesSelected: '{{selected}} selected',
          },
          uploadDocument: 'Upload document',
          addFile: 'Upload file',
          fileName: 'File name',
          remove: 'Remove file',
          documentType: 'Document Type',
          submit: 'Submit',
          selectOne: 'Select one',
          returnDashboard: 'Return to dashboard',
          recovery: {
            summary: 'Upload results: {{uploaded}} uploaded; {{failed}} need attention.',
            uploaded: 'Uploaded',
            notUploaded: 'Not uploaded',
            submitRemaining: 'Submit remaining files',
            finish: 'Finish',
          },
          errorMessage: {},
        },
        header: { menuDashboardHref: 'https://example.test' },
        index: { returnDashboard: 'Return to dashboard' },
        errorSummary: { header: 'Errors: {{count}}' },
      } as never as never),
    );
  vi.mocked(useTranslation).mockReturnValue({ t: translations, i18n: { language: 'en' } } as never);
  vi.mocked(Trans).mockImplementation(({ children }) => createElement('span', undefined, String(children)));
  vi.mocked(useFetcher).mockImplementation(() => {
    const [data, setData] = useState<unknown>();
    const [state, setState] = useState<'idle' | 'submitting'>('idle');
    const submit = async (formData: FormData) => {
      setState('submitting');
      const result = await submitHandler(formData);
      setData(result);
      setState('idle');
    };
    const FetcherForm = ({ children, ...props }: ComponentProps<'form'>) => createElement('form', props, children);
    return { data, state, Form: FetcherForm, submit, formData: undefined } as never;
  });
  const env = clientEnvSchema.parse({ DOCUMENT_UPLOAD_MAX_FILE_COUNT: 3 });
  render(createElement(ClientEnvProvider, { env }, createElement(routes)));
}

async function addFile(file: File) {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error('File picker input not found');
  fireEvent.change(input, { target: { files: [file] } });
  await screen.findByText(file.name);
}
