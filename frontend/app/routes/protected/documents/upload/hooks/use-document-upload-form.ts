import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileState } from '~/components/file-upload';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import type { DocumentUploadFetcherData } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { focusOnNextFrame } from '~/utils/dom-utils';
import { generateId } from '~/utils/id-utils';

type FileStateWithDocumentType = FileState & { readonly documentType: string };
type DocumentUploadFormState = {
  /**
   * The list of documents that are currently pending upload.
   */
  readonly pendingDocuments: ReadonlyArray<FileStateWithDocumentType>;
  /**
   * The list of documents that have been successfully uploaded.
   */
  readonly uploadedDocuments: ReadonlyArray<FileStateWithDocumentType>;
};

export function useDocumentUploadForm() {
  const fetcher = useDocumentUploadFetcher();
  const [documentUploadFormState, setDocumentUploadFormState] = useState<DocumentUploadFormState>({ pendingDocuments: [], uploadedDocuments: [] });
  const [appliedUploadErrorResponse, setAppliedUploadErrorResponse] = useState<DocumentUploadFetcherData>();
  const pendingFileSelectionValidationRef = useRef<{ validationId: string; files: ReadonlyArray<File> } | undefined>(undefined);
  const cancelPendingFocusRef = useRef<(() => void) | undefined>(undefined);
  const currentFileCount = documentUploadFormState.pendingDocuments.length + documentUploadFormState.uploadedDocuments.length;

  const scheduleFocus = useCallback((getElement: () => HTMLElement | null | undefined) => {
    cancelPendingFocusRef.current?.();
    cancelPendingFocusRef.current = focusOnNextFrame(getElement);
  }, []);

  useEffect(() => {
    return function cancelScheduledFocusOnUnmount() {
      cancelPendingFocusRef.current?.();
    };
  }, []);

  const handleBeforeFilesAdd = useCallback(
    (files: ReadonlyArray<File>) => {
      const validationId = crypto.randomUUID();
      const formData = new FormData();
      formData.set('_action', FORM_ACTION.addFiles);
      formData.set('_validation_id', validationId);
      formData.set('current_file_count', currentFileCount.toString());
      for (const { file } of [...documentUploadFormState.pendingDocuments, ...documentUploadFormState.uploadedDocuments]) {
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

  const handleFileChange = useCallback(
    (files: ReadonlyArray<FileState>) => {
      const uploadedFileIds = new Set(documentUploadFormState.uploadedDocuments.map(({ id }) => id));
      const pendingFiles = files.filter(({ id }) => !uploadedFileIds.has(id));
      const previousFileIds = new Set(documentUploadFormState.pendingDocuments.map(({ id }) => id));
      const currentFileIds = new Set(pendingFiles.map(({ id }) => id));
      const firstAddedFile = pendingFiles.find(({ id }) => !previousFileIds.has(id));
      const firstRemovedFile = documentUploadFormState.pendingDocuments.find(({ id }) => !currentFileIds.has(id));

      if (!firstAddedFile && !firstRemovedFile) {
        return;
      }

      if (firstAddedFile) {
        scheduleFocus(() => document.querySelector<HTMLElement>(`#file-upload-item-${CSS.escape(firstAddedFile.id)}`));
      }

      if (firstRemovedFile) {
        const removedIndex = documentUploadFormState.pendingDocuments.findIndex(({ id }) => id === firstRemovedFile.id);
        scheduleFocus(() => {
          const fileNowAtRemovedIndex = pendingFiles[removedIndex];
          const precedingFile = pendingFiles[removedIndex - 1];
          const fileToFocus = fileNowAtRemovedIndex ?? precedingFile;
          const focusTargetId = fileToFocus ? `file-upload-item-${fileToFocus.id}` : 'fileUploadTrigger';
          return document.getElementById(focusTargetId);
        });
      }

      setDocumentUploadFormState((previousState) => {
        const previousFileMap = new Map(previousState.pendingDocuments.map((item) => [item.id, item]));
        return {
          ...previousState,
          pendingDocuments: pendingFiles.map((file) => previousFileMap.get(file.id) ?? Object.assign({}, file, { documentType: '' })),
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
        handleFileChange([...documentUploadFormState.pendingDocuments, ...files]);
      }
    },
    [fetcher.data, documentUploadFormState, handleFileChange],
  );

  const uploadResponse = fetcher.data;
  const isNewUploadErrorResponse = uploadResponse?.source === 'server' && uploadResponse.responseType === 'upload-errors' && uploadResponse !== appliedUploadErrorResponse;

  if (isNewUploadErrorResponse) {
    setAppliedUploadErrorResponse(uploadResponse);
    setDocumentUploadFormState((previousState) => ({
      pendingDocuments: previousState.pendingDocuments.filter((doc) => uploadResponse.pendingDocuments.some((pending) => pending.id === doc.id)),
      uploadedDocuments: [...previousState.pendingDocuments, ...previousState.uploadedDocuments].filter((doc) => uploadResponse.uploadedDocuments.some((uploaded) => uploaded.id === doc.id)),
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

  const handleDocumentTypeChange = useCallback((id: string, documentType: string) => {
    setDocumentUploadFormState((previousState) => ({
      ...previousState,
      pendingDocuments: previousState.pendingDocuments.map((file) => (file.id === id ? { ...file, documentType } : file)),
    }));
  }, []);

  const submitForm = useCallback(
    (form: HTMLFormElement) => {
      const formData = new FormData(form);
      formData.set('_action', FORM_ACTION.upload);
      formData.delete('file_id');
      formData.delete('file_object');
      formData.delete('file_document_type');

      for (const { id, file, documentType } of documentUploadFormState.pendingDocuments) {
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
