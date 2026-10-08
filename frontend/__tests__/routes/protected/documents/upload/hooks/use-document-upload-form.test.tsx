import { act, renderHook } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';

import type { DocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';

function createFetcher(data: DocumentUploadFetcher['data'], submit = vi.fn<DocumentUploadFetcher['submit']>()) {
  return mock<DocumentUploadFetcher>({ data, submit });
}

vi.mock(import('~/routes/protected/documents/upload/hooks/use-document-upload-fetcher'));

beforeEach(() => {
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

  it('preserves selected files, document types, and other form data when submitting', () => {
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

    act(() => {
      result.current.submitForm(form);
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

  it('applies each upload-error response once without discarding files selected afterward', () => {
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
      pendingDocuments: [{ id: 'file-2', fileName: proof.name, fileSize: proof.size, documentType: 'proof-of-coverage' }],
      uploadedDocuments: [{ id: 'file-1', fileName: receipt.name, fileSize: receipt.size, documentType: 'receipt' }],
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

    act(() => {
      result.current.submitForm(document.createElement('form'));
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
          pendingDocuments: [{ id: 'file-3', fileName: extra.name, fileSize: extra.size, documentType: '' }],
          uploadedDocuments: [...uploadErrorResponse.uploadedDocuments, ...uploadErrorResponse.pendingDocuments],
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
