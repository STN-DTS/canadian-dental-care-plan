import { act, renderHook } from '@testing-library/react';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { useDocumentUploadForm } from '~/routes/protected/documents/upload/hooks/use-document-upload-form';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';

function createFetcher(data: DocumentUploadFetcher['data'], submit = vi.fn<DocumentUploadFetcher['submit']>()) {
  return { data, submit } satisfies DocumentUploadFetcher;
}

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
    let fetcher = createFetcher(undefined, submit);
    const { result, rerender } = renderHook(() => useDocumentUploadForm(fetcher, 10));

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
    fetcher = createFetcher(
      {
        formAction: FORM_ACTION.addFiles,
        source: 'client',
        validationId: String(validationId),
        errors: {
          errors: [],
          properties: { files: { errors: ['unsupported file'] } },
        },
      },
      submit,
    );
    rerender();

    expect(result.current.filesWithTypes).toEqual([]);

    act(() => {
      result.current.handleBeforeFilesAdd([file]);
    });
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('preserves selected files, document types, and other form data when submitting', () => {
    const receipt = new File(['receipt'], 'receipt.pdf', { type: 'application/pdf' });
    const proof = new File(['proof'], 'proof.pdf', { type: 'application/pdf' });
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    const { result } = renderHook(() => useDocumentUploadForm(createFetcher(undefined, submit), 10));

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

  it('moves focus to the next remaining file or the upload button after removal', () => {
    const submit = vi.fn<DocumentUploadFetcher['submit']>();
    const { result } = renderHook(() => useDocumentUploadForm(createFetcher(undefined, submit), 10));
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
