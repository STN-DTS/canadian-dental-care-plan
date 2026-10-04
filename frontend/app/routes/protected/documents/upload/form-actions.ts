import type { DocumentUploadSchemaErrorTree } from '~/route-helpers/protected-documents-upload-helpers';

export const FORM_ACTION = {
  upload: 'upload',
  addFiles: 'add-files',
} as const;

export type DocumentUploadFetcherData =
  | {
      formAction: typeof FORM_ACTION.addFiles;
      source: 'client';
      validationId: string;
      errors: DocumentUploadSchemaErrorTree | undefined;
    }
  | {
      formAction: typeof FORM_ACTION.upload;
      source: 'client' | 'server';
      validationId?: undefined;
      errors: DocumentUploadSchemaErrorTree;
    };
