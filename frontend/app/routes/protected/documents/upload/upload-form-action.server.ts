import { data, redirect } from 'react-router';

import * as z from 'zod';

import type { Route } from './+types/upload-form';

import { appContext } from '~/.server/context';
import { getDocumentUploadStateIdFromUrl, getDocumentUploadSubmittedUrl, loadDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import type { UploadDocumentsResponseFailure } from '~/route-helpers/protected-documents-upload-helpers.server';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { session } = context.get(appContext);

  const uploadState = loadDocumentUploadState({ id: getDocumentUploadStateIdFromUrl(url), session, params });

  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');
  const formData = await request.formData();
  const source = 'server' as const;

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));
  if (formAction !== FORM_ACTION.upload) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, responseType: 'validation-errors', errors: validationResult.errors } as const, 400);
  }

  const { files } = validationResult.data;

  const submittedDocuments = Object.entries(files).map(([fileId, { file, documentType }]) => {
    return { id: fileId, fileName: file.name, documentType, fileSize: file.size };
  });

  const scanResult = await scanDocuments(files);
  if (!scanResult.success) {
    return data({ formAction, source, responseType: 'scan-errors', errors: scanResult.errors } as const, 400);
  }

  const uploadResult = await uploadDocuments(files);
  if (!uploadResult.success) {
    // Retrieve the list of documents that failed to upload.
    const pendingDocuments = submittedDocuments.filter((doc) => hasUploadError(doc.id, uploadResult));

    // Retrieve the list of successfully uploaded documents and
    // merge them with previously uploaded documents.
    const uploadedDocuments = [...uploadState.uploadedDocuments, ...submittedDocuments.filter((doc) => !pendingDocuments.some((pending) => pending.id === doc.id))];

    updateDocumentUploadState({ id: uploadState.id, session, params, state: { pendingDocuments, uploadedDocuments } });
    return data({ formAction, source, responseType: 'upload-errors', errors: uploadResult.errors, uploadedDocuments, pendingDocuments } as const, 400);
  }

  // Merge previously uploaded documents with newly uploaded ones.
  const uploadedDocuments = [...uploadState.uploadedDocuments, ...submittedDocuments];
  updateDocumentUploadState({ id: uploadState.id, session, params, state: { pendingDocuments: [], uploadedDocuments: uploadedDocuments } });
  return redirect(getDocumentUploadSubmittedUrl(uploadState.id, params));
}

/**
 * Checks if a document has an upload error.
 */
function hasUploadError(fileId: string, uploadDocumentsFailureResponse: UploadDocumentsResponseFailure): boolean {
  return (uploadDocumentsFailureResponse.errors.properties?.files?.properties?.[fileId]?.errors.length ?? 0) > 0;
}
