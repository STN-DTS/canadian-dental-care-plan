import { useCallback, useEffect, useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import type { FileState } from '~/components/file-upload';
import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree } from '~/route-helpers/protected-documents-upload-helpers';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import type { DocumentUploadFetcherData } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { focusOnNextFrame } from '~/utils/dom-utils';

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
  const { t, i18n } = useTranslation('documents');
  const [documentUploadFormState, setDocumentUploadFormState] = useState<DocumentUploadFormState>({ documents: [] });
  const [reviewState, setReviewState] = useState<'closed' | 'reviewing' | 'submitting'>('closed');
  const [isValidating, setIsValidating] = useState(false);
  const [hasUploadAttempted, setHasUploadAttempted] = useState(false);
  const [validationResponse, setValidationResponse] = useState<{ errors: DocumentUploadSchemaErrorTree } | undefined>(undefined);
  const reviewStateRef = useRef(reviewState);
  const validationInProgressRef = useRef(false);
  const selectionVersionRef = useRef(0);
  const [submittedResponse, setSubmittedResponse] = useState(fetcher.data);
  const [appliedUploadErrorResponse, setAppliedUploadErrorResponse] = useState<DocumentUploadFetcherData>();
  const pendingFocusTargetIdRef = useRef<string | undefined>(undefined);
  const cancelScheduledFocusRef = useRef<(() => void) | undefined>(undefined);
  const currentFileCount = documentUploadFormState.documents.length;

  useEffect(() => {
    reviewStateRef.current = reviewState;
  }, [reviewState]);

  useEffect(() => {
    return function cancelScheduledFocusOnUnmount() {
      cancelScheduledFocusRef.current?.();
    };
  }, []);

  // Wait for FileUploadRoot to sync its controlled value before focusing the item.
  useEffect(() => {
    const focusTargetId = pendingFocusTargetIdRef.current;

    if (!focusTargetId) {
      return;
    }

    pendingFocusTargetIdRef.current = undefined;
    cancelScheduledFocusRef.current?.();
    cancelScheduledFocusRef.current = focusOnNextFrame(() => document.getElementById(focusTargetId));
  }, [documentUploadFormState]);

  /**
   * Synchronizes the file widget selection while retaining uploaded files.
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

      selectionVersionRef.current++;

      if (firstAddedFile) {
        pendingFocusTargetIdRef.current = `file-upload-item-${firstAddedFile.id}`;
      }

      if (firstRemovedFile) {
        const removedIndex = previousPendingDocuments.findIndex(({ id }) => id === firstRemovedFile.id);
        const fileNowAtRemovedIndex = pendingFiles[removedIndex];
        const precedingFile = pendingFiles[removedIndex - 1];
        const fileToFocus = fileNowAtRemovedIndex ?? precedingFile;
        const fallbackFocusId = uploadedFileIds.size > 0 ? 'document-upload-status' : 'fileUploadTrigger';
        pendingFocusTargetIdRef.current = fileToFocus ? `file-upload-item-${fileToFocus.id}` : fallbackFocusId;
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
    [documentUploadFormState],
  );

  /**
   * Validates new files against all listed files before adding them to the pending selection.
   * @param files - The files proposed for selection.
   * @returns Whether the file upload component should add the selected files.
   */
  const handleBeforeFilesAdd = useCallback(
    async (files: ReadonlyArray<File>) => {
      if (validationInProgressRef.current) {
        return false;
      }

      setValidationResponse(undefined);
      validationInProgressRef.current = true;
      setIsValidating(true);
      const selectionVersion = selectionVersionRef.current;
      const existingFiles = documentUploadFormState.documents.map(({ file }) => file);

      try {
        const result = await validateFileSelection({ currentFileCount, existingFiles, files, locale: i18n.language, t });

        if (selectionVersion !== selectionVersionRef.current) {
          return false;
        }

        if (!result.success) {
          setValidationResponse({ errors: result.errors });
          return false;
        }

        return true;
      } catch (error) {
        console.error('Failed to validate the selected upload files.', error);

        if (selectionVersion === selectionVersionRef.current) {
          setValidationResponse({
            errors: {
              errors: [],
              properties: {
                files: {
                  errors: [t(($) => $.upload.errorMessage.fileSelectionFailed)],
                },
              },
            },
          });
        }

        return false;
      } finally {
        validationInProgressRef.current = false;
        setIsValidating(false);
      }
    },
    [currentFileCount, documentUploadFormState.documents, i18n.language, t],
  );

  const uploadResponse = fetcher.data;

  // Close in the response render so the page error summary is no longer inside a modal focus trap.
  if (reviewState === 'submitting' && uploadResponse !== submittedResponse) {
    setReviewState('closed');
  }

  const isNewUploadErrorResponse = uploadResponse?.source === 'server' && uploadResponse.responseType === 'upload-errors' && uploadResponse !== appliedUploadErrorResponse;

  if (isNewUploadErrorResponse) {
    setAppliedUploadErrorResponse(uploadResponse);
    const uploadedFileIds = new Set(uploadResponse.documents.filter(({ status }) => status === 'uploaded').map(({ id }) => id));
    setDocumentUploadFormState((previousState) => ({
      documents: previousState.documents.map((document) => (document.status === 'pending' && uploadedFileIds.has(document.id) ? Object.assign({}, document, { status: 'uploaded' as const }) : document)),
    }));
  }

  /**
   * Updates the document type of a pending file without changing uploaded files.
   * @param id - The selected file ID.
   * @param documentType - The selected document type ID.
   */
  const handleDocumentTypeChange = useCallback((id: string, documentType: string) => {
    selectionVersionRef.current++;
    setDocumentUploadFormState((previousState) => ({
      ...previousState,
      documents: previousState.documents.map((document) => (document.status === 'pending' && document.id === id ? Object.assign({}, document, { documentType }) : document)),
    }));
  }, []);

  /**
   * Builds the next request from pending files, retaining other fields such as the CSRF token.
   * @param form - The form supplying fields such as the CSRF token.
   */
  const createSubmission = useCallback(
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

      return formData;
    },
    [documentUploadFormState],
  );

  /** Validates locally before review; uploaded-only selections can finish directly. */
  const submitForm = useCallback(
    async (form: HTMLFormElement) => {
      if (validationInProgressRef.current || reviewStateRef.current !== 'closed' || fetcher.state !== 'idle') {
        return;
      }

      const formData = createSubmission(form);

      if (formData.get('_action') === FORM_ACTION.finish) {
        void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data', action: form.getAttribute('action') ?? undefined });

        return;
      }

      validationInProgressRef.current = true;
      setIsValidating(true);
      const selectionVersion = selectionVersionRef.current;

      try {
        const files = await getFiles(formData);
        const result = validateUploadedFiles({ files, locale: i18n.language, t });

        if (selectionVersion !== selectionVersionRef.current) {
          return;
        }

        setValidationResponse(result.success ? undefined : { errors: result.errors });

        if (result.success) {
          reviewStateRef.current = 'reviewing';
          setReviewState('reviewing');
        }
      } finally {
        validationInProgressRef.current = false;
        setIsValidating(false);
      }
    },
    [createSubmission, fetcher, i18n.language, t],
  );

  /** Cancels review without changing the selection or sending a request. */
  const dismissReview = useCallback(() => {
    if (reviewStateRef.current === 'reviewing') {
      reviewStateRef.current = 'closed';
      setReviewState('closed');
    }
  }, []);

  /** Sends a confirmed batch once, leaving the dialog busy until the action completes. */
  const confirmSubmit = useCallback(
    async (form: HTMLFormElement) => {
      if (reviewStateRef.current !== 'reviewing' || fetcher.state !== 'idle') {
        return;
      }

      reviewStateRef.current = 'submitting';
      setReviewState('submitting');
      setSubmittedResponse(fetcher.data);
      setValidationResponse(undefined);
      setHasUploadAttempted(true);

      try {
        await fetcher.submit(createSubmission(form), { method: 'post', encType: 'multipart/form-data', action: form.getAttribute('action') ?? undefined });
      } finally {
        reviewStateRef.current = 'closed';
        setReviewState('closed');
      }
    },
    [createSubmission, fetcher],
  );

  return {
    actionData: validationResponse ?? fetcher.data,
    confirmSubmit,
    dismissReview,
    documentUploadFormState,
    handleBeforeFilesAdd,
    handleDocumentTypeChange,
    handleFileChange,
    hasUploadAttempted,
    isValidating,
    reviewState,
    submitForm,
  };
}
