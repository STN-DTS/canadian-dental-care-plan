import type { Get } from 'type-fest';

import { TYPES } from '~/.server/constants';
import { getAppContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { createLogger } from '~/.server/logging';
import { getFixedT } from '~/.server/utils/locale-utils';
import { getUrl } from '~/middlewares/context-storage.server';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { arrayBufferToBase64, isFileContentTypeAllowed } from '~/utils/file-utils';

type ValidateDocumentContentsResponse = { success: true; errors?: undefined } | { success: false; errors: DocumentUploadSchemaErrorTree };

/**
 * Validates file content types locally. EWDU scans files during upload.
 *
 * @param files - Files whose content types must be checked before uploading the batch.
 * @returns Success when every document passes validation; otherwise, file-specific errors.
 */
export async function validateDocumentContents(files: DocumentUploadSchemaOutput['files']): Promise<ValidateDocumentContentsResponse> {
  const log = createLogger('protected-documents-upload-helpers/validateDocumentContents');

  const url = getUrl();
  const t = await getFixedT(url, 'documents');

  const { appContainer } = getAppContext();
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS } = appContainer.get(TYPES.ServerConfig);

  const results = await Promise.all(
    Object.entries(files).map(async ([id, { file, fileBuffer }]) => {
      try {
        const invalidTypeError = t(($) => $.upload.errorMessage.invalidFileType, {
          filename: file.name,
          extensions: DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS.join(', '),
        });

        const isContentTypeAllowed = await isFileContentTypeAllowed({
          allowedExtensions: DOCUMENT_UPLOAD_ALLOWED_FILE_EXTENSIONS,
          declaredMimeType: file.type,
          fileBuffer,
        });

        if (!isContentTypeAllowed) {
          log.warn('File rejected before upload for document [%s]', id);
          return { id, error: invalidTypeError };
        }

        return { id, success: true };
      } catch {
        log.error('Unexpected content validation error for document [%s]', id);
        return { id, error: t(($) => $.upload.errorMessage.contentValidationError, { filename: file.name }) };
      }
    }),
  );

  return processBatchResults(results);
}

export type UploadDocumentsResponseSuccess = { success: true; errors?: undefined };
export type UploadDocumentsResponseFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
export type UploadDocumentsResponse = UploadDocumentsResponseSuccess | UploadDocumentsResponseFailure;

/**
 * Uploads validated documents for a client.
 *
 * @param files - Locally validated files; applicant and user context are resolved server-side.
 * @returns Success when every document uploads; otherwise, file-specific errors.
 */
export async function uploadDocuments(files: DocumentUploadSchemaOutput['files']): Promise<UploadDocumentsResponse> {
  const log = createLogger('protected-documents-upload-helpers/uploadDocuments');

  const user = getUser();
  const applicant = getApplicant();
  const url = getUrl();
  const t = await getFixedT(url, 'documents');

  const { appContainer } = getAppContext();
  const service = appContainer.get(TYPES.DocumentUploadService);

  const results = await Promise.all(
    Object.entries(files).map(async ([id, { file, fileBuffer, documentType }]) => {
      const response = await service.uploadDocument({
        clientNumber: applicant.clientNumber,
        evidentiaryDocumentTypeId: documentType,
        fileName: file.name,
        binary: arrayBufferToBase64(fileBuffer),
        uploadDate: Temporal.Now.instant(),
        lastModifiedDate: Temporal.Instant.fromEpochMilliseconds(file.lastModified),
        userId: user.id,
      });

      switch (response.status) {
        case 'unsafe':
          return { id, error: t(($) => $.upload.errorMessage.scanFailed, { filename: file.name }) };
        case 'rejected':
          return { id, error: t(($) => $.upload.errorMessage.uploadFailed, { filename: file.name }) };
        case 'error':
          return { id, error: t(($) => $.upload.errorMessage.uploadError, { filename: file.name }) };
        case 'success':
          log.trace('Document uploaded successfully: [%s]', id);
          return { id, success: true };
      }
    }),
  );

  return processBatchResults(results);
}

/**
 * Converts batch operation failures into document upload validation errors.
 *
 * @param results - Per-file operation results identified by file ID.
 * @returns Success when no result contains an error; otherwise, an error tree keyed by file ID.
 */
function processBatchResults(results: ReadonlyArray<{ id: string; error?: string }>): UploadDocumentsResponse {
  const failures = results.filter((result): result is { id: string; error: string } => result.error !== undefined);

  if (failures.length === 0) {
    return { success: true };
  }

  const fileProperties: NonNullable<Get<DocumentUploadSchemaErrorTree, 'properties.files.properties'>> = {};

  for (const { id, error } of failures) {
    fileProperties[id] = {
      errors: [],
      properties: {
        file: {
          errors: [error],
        },
      },
    };
  }

  return {
    success: false,
    errors: {
      errors: [],
      properties: {
        files: {
          errors: [],
          properties: fileProperties,
        },
      },
    },
  };
}
