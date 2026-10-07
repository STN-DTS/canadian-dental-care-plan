import { useFetcher } from 'react-router';

import type { clientAction } from '~/routes/protected/documents/upload/upload-form-action.client';
import type { action } from '~/routes/protected/documents/upload/upload-form-action.server';

export function useDocumentUploadFetcher() {
  return useFetcher<typeof action & typeof clientAction>({ key: 'document-upload' });
}

export type DocumentUploadFetcher = ReturnType<typeof useDocumentUploadFetcher>;
export type DocumentUploadFetcherData = DocumentUploadFetcher['data'];
