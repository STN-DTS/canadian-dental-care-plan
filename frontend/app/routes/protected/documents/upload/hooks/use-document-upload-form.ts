import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileState } from '~/components/file-upload';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import type { DocumentUploadFetcherData } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { focusOnNextFrame } from '~/utils/dom-utils';
import { generateId } from '~/utils/id-utils';

type DocumentUploadFileState = FileState & { readonly documentType: string; readonly status: 'pending' | 'uploaded' };
type DocumentUploadFormState = {
  readonly documents: ReadonlyArray<DocumentUploadFileState>;
};

/**
 * Manages selected files, document types, upload outcomes, and focus for the upload form.
 * Retains uploaded files in selection order and submits only pending files on retries.
 * @returns The document list and handlers for selection, document types, and submission.
 */
export function useDocumentUploadForm() {
  const fetcher = useDocumentUploadFetcher();
  const [documentUploadFormState, setDocumentUploadFormState] = useState<DocumentUploadFormState>({ documents: [] });
  const [appliedUploadErrorResponse, setAppliedUploadErrorResponse] = useState<DocumentUploadFetcherData>();
  const pendingFileSelectionValidationRef = useRef<{ validationId: string; files: ReadonlyArray<File> } | undefined>(undefined);
  const cancelPendingFocusRef = useRef<(() => void) | undefined>(undefined);
  const currentFileCount = documentUploadFormState.documents.length;

  /** Schedules focus on the next frame, cancelling any previously scheduled focus. */
  const scheduleFocus = useCallback((getElement: () => HTMLElement | null | undefined) => {
    cancelPendingFocusRef.current?.();
    cancelPendingFocusRef.current = focusOnNextFrame(getElement);
  }, []);

  useEffect(() => {
    return function cancelScheduledFocusOnUnmount() {
      cancelPendingFocusRef.current?.();
    };
  }, []);

  /**
   * Validates new files against all listed files before adding them to the pending selection.
   * @param files - The files proposed for selection.
   * @returns False to defer selection until the matching validation response arrives.
   */
  const handleBeforeFilesAdd = useCallback(
    (files: ReadonlyArray<File>) => {
      const validationId = crypto.randomUUID();
      const formData = new FormData();
      formData.set('_action', FORM_ACTION.addFiles);
      formData.set('_validation_id', validationId);
      formData.set('current_file_count', currentFileCount.toString());
      for (const { file } of documentUploadFormState.documents) {
        formData.append('existing_file_object', file);
      }
      for (const file of files) {
        formData.append('file_object', file);
      }
      pendingFileSelectionValidationRef.current = { validationId, files };
      void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
      return false;
    },
    [fetcher, currentFileCount, documentUploadFormState],
  );

  /**
   * Reconciles pending selection changes, retaining uploaded files and scheduling focus.
   * @param files - The file widget's updated selection.
   */
  const handleFileChange = useCallback(
    (files: ReadonlyArray<FileState>) => {
      const previousPendingDocuments = documentUploadFormState.documents.filter(({ status }) => status === 'pending');
      const uploadedFileIds = new Set(documentUploadFormState.documents.filter(({ status }) => status === 'uploaded').map(({ id }) => id));
      const pendingFiles = files.filter(({ id }) => !uploadedFileIds.has(id));
      const previousFileIds = new Set(previousPendingDocuments.map(({ id }) => id));
      const currentFileIds = new Set(pendingFiles.map(({ id }) => id));
      const firstAddedFile = pendingFiles.find(({ id }) => !previousFileIds.has(id));
      const firstRemovedFile = previousPendingDocuments.find(({ id }) => !currentFileIds.has(id));

      if (!firstAddedFile && !firstRemovedFile) {
        return;
      }

      if (firstAddedFile) {
        scheduleFocus(() => document.querySelector<HTMLElement>(`#file-upload-item-${CSS.escape(firstAddedFile.id)}`));
      }

      if (firstRemovedFile) {
        const removedIndex = previousPendingDocuments.findIndex(({ id }) => id === firstRemovedFile.id);
        scheduleFocus(() => {
          const fileNowAtRemovedIndex = pendingFiles[removedIndex];
          const precedingFile = pendingFiles[removedIndex - 1];
          const fileToFocus = fileNowAtRemovedIndex ?? precedingFile;
          const fallbackFocusId = uploadedFileIds.size > 0 ? 'document-upload-status' : 'fileUploadTrigger';
          const focusTargetId = fileToFocus ? `file-upload-item-${fileToFocus.id}` : fallbackFocusId;
          return document.getElementById(focusTargetId);
        });
      }

      setDocumentUploadFormState((previousState) => {
        const previousFileIds = new Set(previousState.documents.map(({ id }) => id));
        const retainedDocuments = previousState.documents.filter(({ id, status }) => status === 'uploaded' || currentFileIds.has(id));
        const addedDocuments = pendingFiles.filter(({ id }) => !previousFileIds.has(id)).map((file) => Object.assign({}, file, { documentType: '', status: 'pending' as const }));
        return {
          ...previousState,
          documents: [...retainedDocuments, ...addedDocuments],
        };
      });
    },
    [documentUploadFormState, scheduleFocus],
  );

  useEffect(
    function applyFileSelectionValidationResponse() {
      const pendingValidation = pendingFileSelectionValidationRef.current;
      const data = fetcher.data;
      const isPendingValidationResponse = pendingValidation && data?.source === 'client' && data.formAction === FORM_ACTION.addFiles && data.validationId === pendingValidation.validationId;

      if (!isPendingValidationResponse) return;
      pendingFileSelectionValidationRef.current = undefined;

      if (!data.errors) {
        const files = pendingValidation.files.map((file) => ({ id: generateId(), file }));
        handleFileChange([...documentUploadFormState.documents.filter(({ status }) => status === 'pending'), ...files]);
      }
    },
    [fetcher.data, documentUploadFormState, handleFileChange],
  );

  const uploadResponse = fetcher.data;
  const isNewUploadErrorResponse = uploadResponse?.source === 'server' && uploadResponse.responseType === 'upload-errors' && uploadResponse !== appliedUploadErrorResponse;

  if (isNewUploadErrorResponse) {
    setAppliedUploadErrorResponse(uploadResponse);
    const uploadedFileIds = new Set(uploadResponse.documents.filter(({ status }) => status === 'uploaded').map(({ id }) => id));
    setDocumentUploadFormState((previousState) => ({
      documents: previousState.documents.map((document) => (document.status === 'pending' && uploadedFileIds.has(document.id) ? Object.assign({}, document, { status: 'uploaded' as const }) : document)),
    }));
  }

  useEffect(
    function clearPendingFileSelectionAfterUploadError() {
      const data = fetcher.data;
      const isUnsuccessfulUploadResponse = data?.source === 'server' && data.responseType === 'upload-errors';

      if (!isUnsuccessfulUploadResponse) return;
      pendingFileSelectionValidationRef.current = undefined;
    },
    [fetcher.data],
  );

  /**
   * Updates the document type of a pending file without changing uploaded files.
   * @param id - The selected file ID.
   * @param documentType - The selected document type ID.
   */
  const handleDocumentTypeChange = useCallback((id: string, documentType: string) => {
    setDocumentUploadFormState((previousState) => ({
      ...previousState,
      documents: previousState.documents.map((document) => (document.status === 'pending' && document.id === id ? Object.assign({}, document, { documentType }) : document)),
    }));
  }, []);

  /**
   * Submits pending files, or finishes an uploaded-only selection, retaining other form fields.
   * @param form - The form supplying fields such as the CSRF token.
   */
  const submitForm = useCallback(
    (form: HTMLFormElement) => {
      const pendingDocuments = documentUploadFormState.documents.filter(({ status }) => status === 'pending');
      const hasUploadedDocuments = documentUploadFormState.documents.some(({ status }) => status === 'uploaded');
      const formData = new FormData(form);
      formData.set('_action', pendingDocuments.length === 0 && hasUploadedDocuments ? FORM_ACTION.finish : FORM_ACTION.upload);
      formData.delete('file_id');
      formData.delete('file_object');
      formData.delete('file_document_type');

      for (const { id, file, documentType } of pendingDocuments) {
        formData.append('file_id', id);
        formData.append('file_object', file);
        formData.append('file_document_type', documentType);
      }

      void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
    },
    [fetcher, documentUploadFormState],
  );

  return {
    documentUploadFormState,
    handleBeforeFilesAdd,
    handleDocumentTypeChange,
    handleFileChange,
    submitForm,
  };
}
