import { useFetcher } from 'react-router';

import type { clientAction } from '~/routes/protected/documents/upload/upload-form-action.client';
import type { action } from '~/routes/protected/documents/upload/upload-form-action.server';

/**
 * Gets the shared fetcher for client selection validation and server upload actions.
 * @returns The fetcher keyed by `document-upload`, typed with both action handlers.
 */
export function useDocumentUploadFetcher() {
  return useFetcher<typeof action & typeof clientAction>({ key: 'document-upload' });
}

/** The shared document upload fetcher instance type. */
export type DocumentUploadFetcher = ReturnType<typeof useDocumentUploadFetcher>;
/** The latest action response exposed by the shared fetcher, if available. */
export type DocumentUploadFetcherData = DocumentUploadFetcher['data'];
