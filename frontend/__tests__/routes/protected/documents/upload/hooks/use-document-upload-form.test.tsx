import { act, renderHook } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import { getFiles } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { getClientEnv } from '~/utils/env-utils';

function createFetcher(data: DocumentUploadFetcher['data'], submit = vi.fn<DocumentUploadFetcher['submit']>()) {
  return mock<DocumentUploadFetcher>({ data, state: 'idle', submit });
}

vi.mock(import('~/routes/protected/documents/upload/hooks/use-document-upload-fetcher'));
vi.mock(import('~/utils/env-utils'));
vi.mock(import('~/route-helpers/protected-documents-upload-helpers'), async (importOriginal) => {
  const actual = await importOriginal();

  return {
    ...actual,
    getFiles: vi.fn(async (formData: FormData) => {
      const fileIds = formData.getAll('file_id') as string[];
      const fileObjects = formData.getAll('file_object') as File[];
      const documentTypes = formData.getAll('file_document_type') as string[];
      return await Promise.resolve(new Map(fileIds.map((id, index) => [id, { file: fileObjects[index]!, fileBuffer: new ArrayBuffer(1), fileHash: `hash-${id}`, documentType: documentTypes[index] ?? '' }])));
    }),
  };
});

const getFilesMock = vi.mocked(getFiles);
const getClientEnvMock = vi.mocked(getClientEnv, { partial: true });

function createForm() {
  return document.createElement('form');
}

beforeEach(() => {
  vi.clearAllMocks();
  getClientEnvMock.mockReturnValue({
    DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS: ['.pdf'],
    DOCUMENT_UPLOAD_MAX_FILE_COUNT: 10,
    DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB: 5,
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0);
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('useDocumentUploadForm', () => {
  it('validates new files before adding them and clears the pending validation after an error', () => {
    const file = new File(['contents'], 'evidence.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result, rerender } = renderHook(() => useDocumentUploadForm());

    act(() => {
      result.current.handleBeforeFilesAdd([file]);
    });

    const selectionFormData = submit.mock.calls[0]?.[0];
    expect(selectionFormData).toBeInstanceOf(FormData);

    if (!(selectionFormData instanceof FormData)) {
      throw new Error('Expected file selection to submit multipart form data');
    }

    expect(selectionFormData.get('_action')).toBe(FORM_ACTION.addFiles);
    expect(selectionFormData.getAll('file_object')).toEqual([file]);

    const validationId = selectionFormData.get('_validation_id');
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(
      createFetcher(
        {
          formAction: FORM_ACTION.addFiles,
          source: 'client',
          validationId: String(validationId),
          responseType: 'validation-errors',
          errors: {
            errors: [],
            properties: { files: { errors: ['unsupported file'] } },
          },
        },
        submit,
      ),
    );
    rerender();

    expect(result.current.documentUploadFormState.documents).toEqual([]);

    act(() => {
      result.current.handleBeforeFilesAdd([file]);
    });
    expect(submit).toHaveBeenCalledTimes(2);

    const retrySelectionFormData = submit.mock.calls[1]?.[0];

    if (!(retrySelectionFormData instanceof FormData)) {
      throw new Error('Expected file selection to submit multipart form data');
    }

    vi.mocked(useDocumentUploadFetcher).mockReturnValue(
      createFetcher(
        {
          formAction: FORM_ACTION.addFiles,
          source: 'client',
          validationId: String(retrySelectionFormData.get('_validation_id')),
          responseType: 'success',
          errors: undefined,
        },
        submit,
      ),
    );
    rerender();

    expect(result.current.documentUploadFormState.documents).toEqual([{ id: expect.any(String), file, documentType: '', status: 'pending' }]);
    expect(result.current.documentUploadFormState.documents[0]?.file).toBe(file);

    rerender();
    expect(result.current.documentUploadFormState.documents).toHaveLength(1);
  });

  it('preserves selected files, document types, and other form data when a reviewed submission is confirmed', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());

    act(() => {
      result.current.handleFileChange([
        { id: 'file-1', file: receipt },
        { id: 'file-2', file: proof },
      ]);
    });
    act(() => {
      result.current.handleDocumentTypeChange('file-1', 'receipt');
      result.current.handleDocumentTypeChange('file-2', 'proof-of-coverage');
    });

    expect(result.current.documentUploadFormState.documents).toEqual([
      { id: 'file-1', file: receipt, documentType: 'receipt', status: 'pending' },
      { id: 'file-2', file: proof, documentType: 'proof-of-coverage', status: 'pending' },
    ]);

    const form = document.createElement('form');
    const csrfToken = document.createElement('input');
    csrfToken.name = '_csrf';
    csrfToken.value = 'csrf-token';
    form.append(csrfToken);

    await act(async () => {
      await result.current.submitForm(form);
    });

    expect(result.current.reviewState).toBe('reviewing');
    expect(submit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmSubmit(form);
    });

    const submittedFormData = submit.mock.calls[0]?.[0];
    expect(submittedFormData).toBeInstanceOf(FormData);

    if (!(submittedFormData instanceof FormData)) {
      throw new Error('Expected upload to submit multipart form data');
    }

    expect(submittedFormData.get('_action')).toBe(FORM_ACTION.upload);
    expect(submittedFormData.get('_csrf')).toBe('csrf-token');
    expect(submittedFormData.getAll('file_id')).toEqual(['file-1', 'file-2']);
    expect(submittedFormData.getAll('file_object')).toEqual([receipt, proof]);
    expect(submittedFormData.getAll('file_document_type')).toEqual(['receipt', 'proof-of-coverage']);
  });

  it('applies each upload-error response once without discarding files selected afterward', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    const extra = new File(['extra'], 'extra.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result, rerender } = renderHook(() => useDocumentUploadForm());

    act(() => {
      result.current.handleFileChange([
        { id: 'file-1', file: receipt },
        { id: 'file-2', file: proof },
      ]);
    });
    act(() => {
      result.current.handleDocumentTypeChange('file-1', 'receipt');
      result.current.handleDocumentTypeChange('file-2', 'proof-of-coverage');
    });

    const uploadErrorResponse = {
      formAction: FORM_ACTION.upload,
      source: 'server' as const,
      responseType: 'upload-errors' as const,
      errors: { errors: [] },
      documents: [
        { id: 'file-1', fileName: receipt.name, fileSize: receipt.size, documentType: 'receipt', status: 'uploaded' as const },
        { id: 'file-2', fileName: proof.name, fileSize: proof.size, documentType: 'proof-of-coverage', status: 'pending' as const },
      ],
    };
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(uploadErrorResponse, submit));
    rerender();

    expect(result.current.documentUploadFormState.documents).toEqual([
      { id: 'file-1', file: receipt, documentType: 'receipt', status: 'uploaded' },
      { id: 'file-2', file: proof, documentType: 'proof-of-coverage', status: 'pending' },
    ]);

    const uploadedDocument = result.current.documentUploadFormState.documents[0];
    act(() => {
      result.current.handleDocumentTypeChange('file-1', 'other');
    });
    expect(result.current.documentUploadFormState.documents[0]).toBe(uploadedDocument);

    const retryForm = createForm();
    await act(async () => {
      await result.current.submitForm(retryForm);
    });
    expect(result.current.reviewState).toBe('reviewing');
    expect(submit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmSubmit(retryForm);
    });

    const retryFormData = submit.mock.calls[0]?.[0];
    expect(retryFormData).toBeInstanceOf(FormData);

    if (!(retryFormData instanceof FormData)) {
      throw new Error('Expected upload retry to submit multipart form data');
    }

    expect(retryFormData.getAll('file_id')).toEqual(['file-2']);
    expect(retryFormData.getAll('file_object')).toEqual([proof]);
    expect(retryFormData.getAll('file_document_type')).toEqual(['proof-of-coverage']);

    act(() => {
      result.current.handleBeforeFilesAdd([extra]);
    });

    const selectionFormData = submit.mock.calls[1]?.[0];
    expect(selectionFormData).toBeInstanceOf(FormData);

    if (!(selectionFormData instanceof FormData)) {
      throw new Error('Expected file selection to submit multipart form data');
    }

    expect.soft(selectionFormData.get('current_file_count')).toBe('2');
    expect.soft(selectionFormData.getAll('existing_file_object')).toEqual([receipt, proof]);

    act(() => {
      result.current.handleFileChange([...result.current.documentUploadFormState.documents, { id: 'file-3', file: extra }]);
    });
    rerender();

    expect(result.current.documentUploadFormState.documents.filter(({ status }) => status === 'pending').map(({ id }) => id)).toEqual(['file-2', 'file-3']);

    vi.mocked(useDocumentUploadFetcher).mockReturnValue(
      createFetcher(
        {
          ...uploadErrorResponse,
          documents: [...uploadErrorResponse.documents.map((document) => Object.assign({}, document, { status: 'uploaded' as const })), { id: 'file-3', fileName: extra.name, fileSize: extra.size, documentType: '', status: 'pending' as const }],
        },
        submit,
      ),
    );
    rerender();

    expect(result.current.documentUploadFormState.documents).toEqual([
      { id: 'file-1', file: receipt, documentType: 'receipt', status: 'uploaded' },
      { id: 'file-2', file: proof, documentType: 'proof-of-coverage', status: 'uploaded' },
      { id: 'file-3', file: extra, documentType: '', status: 'pending' },
    ]);

    const uploadedDocuments = result.current.documentUploadFormState.documents.filter(({ status }) => status === 'uploaded');
    const uploadButton = document.createElement('button');
    uploadButton.id = 'fileUploadTrigger';
    const uploadStatusRegion = document.createElement('div');
    uploadStatusRegion.id = 'document-upload-status';
    uploadStatusRegion.setAttribute('role', 'region');
    uploadStatusRegion.tabIndex = -1;
    document.body.append(uploadButton, uploadStatusRegion);

    act(() => {
      result.current.handleFileChange(uploadedDocuments);
    });

    expect(result.current.documentUploadFormState.documents).toEqual(uploadedDocuments);
    expect(uploadStatusRegion).toHaveFocus();

    const form = document.createElement('form');

    for (const [name, value] of [
      ['_csrf', 'csrf-token'],
      ['file_id', 'removed-file'],
      ['file_document_type', 'receipt'],
    ] as const) {
      const input = document.createElement('input');
      input.name = name;
      input.value = value;
      form.append(input);
    }

    await act(async () => {
      await result.current.submitForm(form);
    });
    const finishFormData = submit.mock.lastCall?.[0];

    if (!(finishFormData instanceof FormData)) {
      throw new Error('Expected a finish submission');
    }

    expect(finishFormData.get('_action')).toBe(FORM_ACTION.finish);
    expect(finishFormData.get('_csrf')).toBe('csrf-token');
    expect(finishFormData.getAll('file_id')).toEqual([]);
    expect(finishFormData.getAll('file_object')).toEqual([]);
    expect(finishFormData.getAll('file_document_type')).toEqual([]);
  });

  it('cancels a review and builds the confirmed request from the current edited selection', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());
    const form = createForm();

    act(() => {
      result.current.handleFileChange([{ id: 'file-1', file: receipt }]);
      result.current.handleDocumentTypeChange('file-1', 'receipt');
    });
    await act(async () => {
      await result.current.submitForm(form);
    });
    expect(result.current.reviewState).toBe('reviewing');

    act(() => {
      result.current.dismissReview();
      result.current.handleDocumentTypeChange('file-1', 'proof-of-coverage');
    });
    expect(result.current.reviewState).toBe('closed');

    await act(async () => {
      await result.current.submitForm(form);
    });
    expect(result.current.reviewState).toBe('reviewing');
    expect(submit).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.confirmSubmit(form);
    });

    const submittedFormData = submit.mock.calls[0]?.[0];
    expect(submittedFormData).toBeInstanceOf(FormData);
    expect((submittedFormData as FormData).getAll('file_document_type')).toEqual(['proof-of-coverage']);
  });

  it('locks the review while confirming so dismissing or confirming again cannot send a duplicate request', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    let resolveSubmit: () => void;
    const submitFinished = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const submit = vi.fn<DocumentUploadFetcher['submit']>().mockImplementation(async () => await submitFinished);
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());
    const form = createForm();

    act(() => {
      result.current.handleFileChange([{ id: 'file-1', file: receipt }]);
      result.current.handleDocumentTypeChange('file-1', 'receipt');
    });
    await act(async () => {
      await result.current.submitForm(form);
    });

    let confirmation: Promise<void>;
    act(() => {
      confirmation = result.current.confirmSubmit(form);
    });
    expect(result.current.reviewState).toBe('submitting');

    act(() => {
      result.current.dismissReview();
      void result.current.confirmSubmit(form);
    });
    expect(result.current.reviewState).toBe('submitting');
    expect(submit).toHaveBeenCalledOnce();

    resolveSubmit!();
    await act(async () => {
      await confirmation!;
    });
    expect(result.current.reviewState).toBe('closed');
  });

  it.each([
    { name: 'no pending files', documents: [] as const },
    { name: 'a missing document type', documents: [{ id: 'missing-type', file: new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' }), documentType: '' }] },
    { name: 'an invalid file', documents: [{ id: 'invalid-file', file: new File(['receipt'], 'receipt.exe', { type: 'application/octet-stream' }), documentType: 'receipt' }] },
  ])('keeps the review closed and selection intact when local validation finds $name', async ({ documents }) => {
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());
    const form = createForm();

    act(() => {
      result.current.handleFileChange(documents.map(({ id, file }) => ({ id, file })));

      for (const { id, documentType } of documents) {
        result.current.handleDocumentTypeChange(id, documentType);
      }
    });
    await act(async () => {
      await result.current.submitForm(form);
    });

    expect(result.current.reviewState).toBe('closed');
    expect(result.current.actionData?.errors).toBeDefined();
    expect(result.current.documentUploadFormState.documents).toEqual(documents.map(({ id, file, documentType }) => ({ id, file, documentType, status: 'pending' })));
    expect(submit).not.toHaveBeenCalled();
  });

  it('closes after a server failure, preserves partial uploads, and requires a new review before retrying', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    let resolveSubmit: () => void;
    const submitFinished = new Promise<void>((resolve) => {
      resolveSubmit = resolve;
    });
    const submit = vi.fn<DocumentUploadFetcher['submit']>().mockImplementationOnce(async () => await submitFinished);
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result, rerender } = renderHook(() => useDocumentUploadForm());
    const form = createForm();

    act(() => {
      result.current.handleFileChange([
        { id: 'file-1', file: receipt },
        { id: 'file-2', file: proof },
      ]);
      result.current.handleDocumentTypeChange('file-1', 'receipt');
      result.current.handleDocumentTypeChange('file-2', 'proof-of-coverage');
    });
    await act(async () => {
      await result.current.submitForm(form);
    });
    let confirmation: Promise<void>;
    act(() => {
      confirmation = result.current.confirmSubmit(form);
    });

    vi.mocked(useDocumentUploadFetcher).mockReturnValue(
      createFetcher(
        {
          formAction: FORM_ACTION.upload,
          source: 'server',
          responseType: 'upload-errors',
          errors: { errors: [] },
          documents: [
            { id: 'file-1', fileName: receipt.name, fileSize: receipt.size, documentType: 'receipt', status: 'uploaded' },
            { id: 'file-2', fileName: proof.name, fileSize: proof.size, documentType: 'proof-of-coverage', status: 'pending' },
          ],
        },
        submit,
      ),
    );
    rerender();
    expect(result.current.reviewState).toBe('closed');
    expect(result.current.documentUploadFormState.documents.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: 'file-1', status: 'uploaded' },
      { id: 'file-2', status: 'pending' },
    ]);

    resolveSubmit!();
    await act(async () => {
      await confirmation!;
      await result.current.submitForm(form);
    });
    expect(result.current.reviewState).toBe('reviewing');
    expect(submit).toHaveBeenCalledOnce();

    await act(async () => {
      await result.current.confirmSubmit(form);
    });
    const retryFormData = submit.mock.calls[1]?.[0] as FormData;
    expect(retryFormData.getAll('file_id')).toEqual(['file-2']);
    expect(retryFormData.getAll('file_object')).toEqual([proof]);
  });

  it('submits uploaded-only selections directly as a finish action', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result, rerender } = renderHook(() => useDocumentUploadForm());

    act(() => {
      result.current.handleFileChange([{ id: 'file-1', file: receipt }]);
      result.current.handleDocumentTypeChange('file-1', 'receipt');
    });
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(
      createFetcher(
        {
          formAction: FORM_ACTION.upload,
          source: 'server',
          responseType: 'upload-errors',
          errors: { errors: [] },
          documents: [{ id: 'file-1', fileName: receipt.name, fileSize: receipt.size, documentType: 'receipt', status: 'uploaded' }],
        },
        submit,
      ),
    );
    rerender();

    await act(async () => {
      await result.current.submitForm(createForm());
    });
    expect(result.current.reviewState).toBe('closed');
    expect(submit).toHaveBeenCalledOnce();
    expect((submit.mock.calls[0]![0] as FormData).get('_action')).toBe(FORM_ACTION.finish);
  });

  it('does not open a review when an asynchronous validation becomes stale after an edit', async () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    let resolveFiles: (files: Awaited<ReturnType<typeof getFiles>>) => void;
    const filesReady = new Promise<Awaited<ReturnType<typeof getFiles>>>((resolve) => {
      resolveFiles = resolve;
    });
    getFilesMock.mockImplementationOnce(async () => await filesReady);
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());

    act(() => {
      result.current.handleFileChange([{ id: 'file-1', file: receipt }]);
      result.current.handleDocumentTypeChange('file-1', 'receipt');
      void result.current.submitForm(createForm());
      result.current.handleDocumentTypeChange('file-1', 'proof-of-coverage');
    });
    expect(result.current.isValidating).toBe(true);

    resolveFiles!(new Map([['file-1', { file: receipt, fileBuffer: new ArrayBuffer(1), fileHash: 'hash-file-1', documentType: 'receipt' }]]));
    await act(async () => {
      await filesReady;
    });

    expect(result.current.isValidating).toBe(false);
    expect(result.current.reviewState).toBe('closed');
    expect(submit).not.toHaveBeenCalled();
  });

  it('moves focus to the next remaining file or the upload button after removal', () => {
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    vi.mocked(useDocumentUploadFetcher).mockReturnValue(createFetcher(undefined, submit));
    const { result } = renderHook(() => useDocumentUploadForm());
    const firstFileItem = document.createElement('div');
    firstFileItem.id = 'file-upload-item-file-1';
    firstFileItem.tabIndex = -1;
    const secondFileItem = document.createElement('div');
    secondFileItem.id = 'file-upload-item-file-2';
    secondFileItem.tabIndex = -1;
    const uploadButton = document.createElement('button');
    uploadButton.id = 'fileUploadTrigger';
    document.body.append(firstFileItem, secondFileItem, uploadButton);

    act(() => {
      result.current.handleFileChange([
        { id: 'file-1', file: new File(['first'], 'first.pdf') },
        { id: 'file-2', file: new File(['second'], 'second.pdf') },
      ]);
    });
    expect(firstFileItem).toHaveFocus();

    act(() => {
      result.current.handleFileChange([{ id: 'file-2', file: new File(['second'], 'second.pdf') }]);
    });
    expect(secondFileItem).toHaveFocus();

    act(() => {
      result.current.handleFileChange([]);
    });
    expect(uploadButton).toHaveFocus();
  });
});
