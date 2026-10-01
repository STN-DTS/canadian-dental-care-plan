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

type ScanDocumentsResponseSuccess = { success: true; scannedFileIds: ReadonlyArray<string>; errors?: undefined };
type ScanDocumentsResponseFailure = { success: false; scannedFileIds: ReadonlyArray<string>; errors: DocumentUploadSchemaErrorTree };
type ScanDocumentsResponse = ScanDocumentsResponseSuccess | ScanDocumentsResponseFailure;

/**
 * Validates file content types and scans documents for security threats.
 *
 * @param args - Files, allowed extensions, user context, service, and translator.
 * @returns Success when every document passes validation and scanning; otherwise, file-specific errors.
 */
export async function scanDocuments(files: DocumentUploadSchemaOutput['files']): Promise<ScanDocumentsResponse> {
  const log = createLogger('protected-documents-upload-helpers/scanDocuments');

  const user = getUser();
  const url = getUrl();
  const t = await getFixedT(url, 'documents');

  const { appContainer } = getAppContext();
  const documentUploadService = appContainer.get(TYPES.DocumentUploadService);
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
          log.warn('File rejected before security scan for document [%s]', id);
          return { id, error: invalidTypeError };
        }

        const scanResponse = await documentUploadService.scanDocument({
          fileName: file.name,
          binary: arrayBufferToBase64(fileBuffer),
          userId: user.id,
        });

        if (scanResponse.Error) {
          log.warn('Security scan rejected document [%s] with code [%s]', id, scanResponse.Error.ErrorCode);
          return { id, error: t(($) => $.upload.errorMessage.scanFailed, { filename: file.name }) };
        }

        log.trace('Security scan passed for document [%s]', id);
        return { id, success: true };
      } catch {
        log.error('Unexpected security scan error for document [%s]', id);
        return { id, error: t(($) => $.upload.errorMessage.scanError, { filename: file.name }) };
      }
    }),
  );

  const result = processBatchResults(results);
  return result.success ? { success: true, scannedFileIds: result.successfulFileIds } : { success: false, scannedFileIds: result.successfulFileIds, errors: result.errors };
}

type UploadDocumentsResponseSuccess = { success: true; uploadedFileIds: ReadonlyArray<string>; errors?: undefined };
type UploadDocumentsResponseFailure = { success: false; uploadedFileIds: ReadonlyArray<string>; errors: DocumentUploadSchemaErrorTree };
type UploadDocumentsResponse = UploadDocumentsResponseSuccess | UploadDocumentsResponseFailure;

/**
 * Uploads validated documents for a client.
 *
 * @param args - Client context, files, user context, service, and translator.
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
      try {
        const response = await service.uploadDocument({
          clientNumber: applicant.clientNumber,
          evidentiaryDocumentTypeId: documentType,
          fileName: file.name,
          binary: arrayBufferToBase64(fileBuffer),
          uploadDate: new Date(),
          lastModifiedDate: new Date(file.lastModified),
          userId: user.id,
        });

        if (response.Error) {
          log.warn('Upload rejected for document [%s] with code [%s]', id, response.Error.ErrorCode);
          return { id, error: t(($) => $.upload.errorMessage.uploadFailed, { filename: file.name }) };
        }

        log.trace('Document uploaded successfully: [%s]', id);
        return { id, success: true };
      } catch {
        log.error('Unexpected file upload error for document [%s]', id);
        return { id, error: t(($) => $.upload.errorMessage.uploadError, { filename: file.name }) };
      }
    }),
  );

  const result = processBatchResults(results);
  return result.success ? { success: true, uploadedFileIds: result.successfulFileIds } : { success: false, uploadedFileIds: result.successfulFileIds, errors: result.errors };
}

/**
 * Converts batch operation failures into document upload validation errors.
 *
 * @param results - Per-file operation results identified by file ID.
 * @returns Success when no result contains an error; otherwise, an error tree keyed by file ID.
 */
type BatchResults = { success: true; successfulFileIds: ReadonlyArray<string> } | { success: false; successfulFileIds: ReadonlyArray<string>; errors: DocumentUploadSchemaErrorTree };

function processBatchResults(results: ReadonlyArray<{ id: string; error?: string }>): BatchResults {
  const successfulFileIds = results.filter((result) => result.error === undefined).map(({ id }) => id);
  const failures = results.filter((result): result is { id: string; error: string } => result.error !== undefined);
  if (failures.length === 0) {
    return { success: true, successfulFileIds };
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
    successfulFileIds,
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
