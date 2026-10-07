import { useCallback, useEffect, useRef, useState } from 'react';

import type { FileState } from '~/components/file-upload';
import { useDocumentUploadFetcher } from '~/routes/protected/documents/upload/hooks/use-document-upload-fetcher';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { focusOnNextFrame } from '~/utils/dom-utils';

export type FileStateWithDocumentType = FileState & { readonly documentType: string };

export function useDocumentUploadForm() {
  const fetcher = useDocumentUploadFetcher();
  const [filesWithTypes, setFilesWithTypes] = useState<FileStateWithDocumentType[]>([]);
  const pendingFileValidationRef = useRef<{ validationId: string; files: ReadonlyArray<File> } | undefined>(undefined);
  const cancelPendingFocusRef = useRef<(() => void) | undefined>(undefined);

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
      formData.set('current_file_count', filesWithTypes.length.toString());
      for (const { file } of filesWithTypes) {
        formData.append('existing_file_object', file);
      }
      for (const file of files) {
        formData.append('file_object', file);
      }

      pendingFileValidationRef.current = { validationId, files };
      void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
      return false;
    },
    [fetcher, filesWithTypes],
  );

  const handleFileChange = useCallback(
    (files: ReadonlyArray<FileState>) => {
      const previousFileIds = new Set(filesWithTypes.map(({ id }) => id));
      const currentFileIds = new Set(files.map(({ id }) => id));
      const firstAddedFile = files.find(({ id }) => !previousFileIds.has(id));
      const firstRemovedFile = filesWithTypes.find(({ id }) => !currentFileIds.has(id));

      if (!firstAddedFile && !firstRemovedFile) {
        return;
      }

      if (firstAddedFile) {
        scheduleFocus(() => document.querySelector<HTMLElement>(`#file-upload-item-${CSS.escape(firstAddedFile.id)}`));
      }

      if (firstRemovedFile) {
        const removedIndex = filesWithTypes.findIndex(({ id }) => id === firstRemovedFile.id);
        scheduleFocus(() => {
          const fileNowAtRemovedIndex = files[removedIndex];
          const precedingFile = files[removedIndex - 1];
          const fileToFocus = fileNowAtRemovedIndex ?? precedingFile;
          const focusTargetId = fileToFocus ? `file-upload-item-${fileToFocus.id}` : 'fileUploadTrigger';
          return document.getElementById(focusTargetId);
        });
      }

      setFilesWithTypes((previousFiles) => {
        const previousFileMap = new Map(previousFiles.map((item) => [item.id, item]));
        return files.map((file) => previousFileMap.get(file.id) ?? { ...file, documentType: '' });
      });
    },
    [filesWithTypes, scheduleFocus],
  );

  useEffect(() => {
    const pendingValidation = pendingFileValidationRef.current;
    const data = fetcher.data;

    if (!pendingValidation || !data) {
      return;
    }

    if (data.source !== 'client' || data.formAction !== FORM_ACTION.addFiles || data.validationId !== pendingValidation.validationId) {
      return;
    }

    pendingFileValidationRef.current = undefined;

    if (data.errors) {
      return;
    }

    const files = pendingValidation.files.map((file) => ({ id: crypto.randomUUID(), file }));
    handleFileChange([...filesWithTypes, ...files]);
  }, [fetcher.data, filesWithTypes, handleFileChange]);

  const handleDocumentTypeChange = useCallback((id: string, documentType: string) => {
    setFilesWithTypes((previousFiles) => previousFiles.map((file) => (file.id === id ? { ...file, documentType } : file)));
  }, []);

  const submitForm = useCallback(
    (form: HTMLFormElement) => {
      const formData = new FormData(form);
      formData.set('_action', FORM_ACTION.upload);
      formData.delete('file_id');
      formData.delete('file_object');
      formData.delete('file_document_type');

      for (const { id, file, documentType } of filesWithTypes) {
        formData.append('file_id', id);
        formData.append('file_object', file);
        formData.append('file_document_type', documentType);
      }

      void fetcher.submit(formData, { method: 'post', encType: 'multipart/form-data' });
    },
    [fetcher, filesWithTypes],
  );

  return {
    filesWithTypes,
    handleBeforeFilesAdd,
    handleDocumentTypeChange,
    handleFileChange,
    submitForm,
  };
}
