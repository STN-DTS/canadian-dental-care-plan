import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';

import { TYPES } from '~/.server/constants';
import { getAppContext } from '~/.server/context/app-context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { createLogger } from '~/.server/logging';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { getUrl } from '~/middlewares/context-storage.server';
import { createDocumentUploadFileErrorTree, validateUploadedFileContents } from '~/route-helpers/protected-documents-upload-helpers';
import type { DocumentUploadSchemaErrorTree, DocumentUploadSchemaOutput, ValidateUploadedFileContentsResult } from '~/route-helpers/protected-documents-upload-helpers';
import { arrayBufferToBase64 } from '~/utils/file-utils';

/**
 * Validates file content types locally using server configuration. EWDU scans files during upload.
 *
 * @param files - Files whose content types must be checked before uploading the batch.
 * @returns Success when every document passes validation; otherwise, file-specific errors.
 */
export async function validateDocumentContents(files: Readonly<Record<string, { file: File }>>): Promise<ValidateUploadedFileContentsResult> {
  const log = createLogger('protected-documents-upload-helpers/validateDocumentContents');

  const url = getUrl();
  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');

  const { appContainer } = getAppContext();
  const { DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES } = appContainer.get(TYPES.ServerConfig);

  return await validateUploadedFileContents({
    allowedFileTypes: DOCUMENT_UPLOAD_ALLOWED_FILE_TYPES,
    files,
    locale,
    t,
    onFailure: ({ reason, cause }) => {
      if (reason === 'unsupported_file_extension') {
        log.debug('File extension rejected before upload', { [ATTR_ERROR_TYPE]: reason });
      } else if (reason === 'unsupported_file_content_type') {
        log.debug('File content type rejected before upload', { [ATTR_ERROR_TYPE]: reason });
      } else {
        log.error(cause, { [ATTR_ERROR_TYPE]: reason });
      }
    },
  });
}

export type UploadDocumentsResponseSuccess = { success: true; errors?: undefined; uploadDates: Readonly<Record<string, string>> };
export type UploadDocumentsResponseFailure = { success: false; errors: DocumentUploadSchemaErrorTree; uploadDates: Readonly<Record<string, string>> };
export type UploadDocumentsResponse = UploadDocumentsResponseSuccess | UploadDocumentsResponseFailure;

/**
 * Uploads validated documents for a client.
 *
 * @param files - Locally validated files; applicant and user context are resolved server-side.
 * @returns Success when every document uploads; otherwise, file-specific errors.
 */
export async function uploadDocuments(files: DocumentUploadSchemaOutput['files']): Promise<UploadDocumentsResponse> {
  const userId = getUser().id;
  const applicant = getApplicant();
  const url = getUrl();
  const t = await getFixedT(url, 'documents');

  const { appContainer } = getAppContext();
  const service = appContainer.get(TYPES.DocumentUploadService);

  const results = await Promise.all(
    Object.entries(files).map(async ([id, { file, fileBuffer, documentType }]) => {
      const uploadDate = Temporal.Now.instant();
      const response = await service.uploadDocument({
        clientNumber: applicant.clientNumber,
        evidentiaryDocumentTypeId: documentType,
        fileName: file.name,
        binary: arrayBufferToBase64(fileBuffer),
        uploadDate,
        lastModifiedDate: Temporal.Instant.fromEpochMilliseconds(file.lastModified),
        userId,
      });

      switch (response.status) {
        case 'unsafe':
          return { id, error: t(($) => $.upload.errorMessage.scanFailed, { filename: file.name }) };
        case 'rejected':
          return { id, error: t(($) => $.upload.errorMessage.uploadFailed, { filename: file.name }) };
        case 'error':
          return { id, error: t(($) => $.upload.errorMessage.uploadError, { filename: file.name }) };
        case 'success':
          return { id, success: true, uploadDate: uploadDate.toString() };
      }
    }),
  );

  return {
    ...createDocumentUploadFileErrorTree(results),
    uploadDates: Object.fromEntries(results.flatMap(({ id, uploadDate }) => (uploadDate === undefined ? [] : [[id, uploadDate]]))),
  };
}
