import { TYPES } from '~/.server/constants';
import { getAppContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { getFixedT } from '~/.server/utils/locale-utils';
import { getUrl } from '~/middlewares/context-storage.server';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput } from '~/route-helpers/protected-documents-upload-helpers';
import { arrayBufferToBase64, isFileContentTypeAllowed } from '~/utils/file-utils';

type ScanDocumentsResponseSuccess = { success: true; errors?: undefined };
type ScanDocumentsResponseFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
type ScanDocumentsResponse = ScanDocumentsResponseSuccess | ScanDocumentsResponseFailure;

/**
 * Validates file content types and scans documents for security threats.
 *
 * @param args - Files, allowed extensions, user context, service, and translator.
 * @returns Success when every document passes validation and scanning; otherwise, file-specific errors.
 */
export async function scanDocuments(files: DocumentUploadSchemaOutput['files']): Promise<ScanDocumentsResponse> {
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
          return { id, error: invalidTypeError };
        }

        const scanResponse = await documentUploadService.scanDocument({
          fileName: file.name,
          binary: arrayBufferToBase64(fileBuffer),
          userId: user.id,
        });

        if (scanResponse.Error) {
          return {
            id,
            error: t(($) => $.upload.errorMessage.scanFailed, {
              error: scanResponse.Error.ErrorMessage,
              code: scanResponse.Error.ErrorCode,
            }),
          };
        }

        return {
          id,
          success: true,
        };
      } catch {
        return {
          id,
          error: t(($) => $.upload.errorMessage.scanError),
        };
      }
    }),
  );

  return processBatchResults(results);
}

type UploadDocumentsResponseSuccess = { success: true; errors?: undefined };
type UploadDocumentsResponseFailure = { success: false; errors: DocumentUploadSchemaErrorTree };
type UploadDocumentsResponse = UploadDocumentsResponseSuccess | UploadDocumentsResponseFailure;

/**
 * Uploads validated documents for a client.
 *
 * @param args - Client context, files, user context, service, and translator.
 * @returns Success when every document uploads; otherwise, file-specific errors.
 */
export async function uploadDocuments(files: DocumentUploadSchemaOutput['files']): Promise<UploadDocumentsResponse> {
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
          return {
            id,
            error: t(($) => $.upload.errorMessage.uploadFailed, {
              error: response.Error.ErrorMessage,
              code: response.Error.ErrorCode,
            }),
          };
        }

        return {
          id,
          success: true,
        };
      } catch {
        return {
          id,
          error: t(($) => $.upload.errorMessage.uploadError),
        };
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
  const failures = results.filter((result) => result.error);
  if (failures.length === 0) {
    return { success: true };
  }

  const errors: DocumentUploadSchemaErrorTree = { errors: [], properties: { files: { errors: [], properties: {} } } };
  for (const { id, error } of failures) {
    if (error && errors.properties?.files?.properties) {
      errors.properties.files.properties[id] = {
        errors: [],
        properties: {
          file: {
            errors: [error],
          },
        },
      };
    }
  }
  return { success: false, errors };
}
