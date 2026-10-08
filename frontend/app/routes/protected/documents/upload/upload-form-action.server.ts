import { data, redirect } from 'react-router';

import type { TFunction } from 'i18next';
import * as z from 'zod';

import type { Route } from './+types/upload-form';

import { appContext } from '~/.server/context';
import { finishDocumentUploadState, getDocumentUploadSubmittedUrl, loadDocumentUploadState, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { getFiles, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import type { UploadDocumentsResponseFailure } from '~/route-helpers/protected-documents-upload-helpers.server';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import type { FormAction } from '~/routes/protected/documents/upload/upload-form-action';

const source = 'server' as const;

/**
 * Loads the upload flow and dispatches upload or explicit completion requests.
 * @param args - The route context, flow parameters, request, and localized URL.
 * @returns A tagged upload error response or a confirmation redirect.
 * @throws If the flow or form action is invalid.
 */
export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { session } = context.get(appContext);
  const uploadState = loadDocumentUploadState({ id: params.id, session, params });

  const formData = await request.formData();
  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.finish) {
    return finishAction({ formAction, formData, params, session, uploadState });
  }

  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');
  return await uploadAction({ formAction, formData, uploadState, locale, t, session, params });
}

type FinishActionParams = {
  formAction: FormAction;
  formData: FormData;
  params: Route.ActionArgs['params'];
  session: Session;
  uploadState: DocumentUploadState;
};

/**
 * Clears obsolete pending metadata and completes a flow after a metadata-only finish request.
 * @param args - The completion action, submitted fields, route parameters, session, and flow.
 * @returns A redirect to the upload confirmation page.
 * @throws If the action is invalid, upload fields are present, or the flow cannot finish.
 */
function finishAction({ formAction, formData, params, session, uploadState }: FinishActionParams) {
  if (formAction !== FORM_ACTION.finish) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  if (formData.has('file_id') || formData.has('file_object') || [...formData.values()].some((value) => typeof value !== 'string')) {
    throw data(null, { status: 400 });
  }

  if (uploadState.status === 'finished' || uploadState.uploadedDocuments.length === 0) {
    throw data(null, { status: 409 });
  }

  updateDocumentUploadState({ id: uploadState.id, session, params, state: { pendingDocuments: [], uploadedDocuments: uploadState.uploadedDocuments } });
  finishDocumentUploadState({ id: uploadState.id, session, params });
  return redirect(getDocumentUploadSubmittedUrl(uploadState.id, params));
}

type UploadActionParams = {
  formAction: FormAction;
  formData: FormData;
  locale: string;
  params: Route.ActionArgs['params'];
  session: Session;
  t: TFunction<'documents'>;
  uploadState: DocumentUploadState;
};

/**
 * Validates, scans, and uploads the submitted pending batch, preserving earlier successful uploads.
 * Records the validated batch as pending before scanning and retains failed files for retry.
 * @param args - The upload action, submitted fields, locale, route parameters, session, translator, and flow.
 * @returns A tagged validation, scan, or upload error response, or a redirect after completion.
 * @throws If the action or flow is invalid, parsing fails, no files are present, or an uploaded ID is resubmitted.
 */
async function uploadAction({ formAction, formData, locale, params, session, t, uploadState }: UploadActionParams) {
  if (formAction !== FORM_ACTION.upload) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  const fileIds = formData.getAll('file_id');
  const fileObjects = formData.getAll('file_object');
  if (fileIds.length === 0 || fileIds.length !== fileObjects.length || fileIds.some((value) => typeof value !== 'string' || !value.trim()) || fileObjects.some((value) => typeof value === 'string') || new Set(fileIds).size !== fileIds.length) {
    throw data(null, { status: 400 });
  }

  const files = await getFiles(formData);
  const hasFiles = files.size !== 0;
  if (!hasFiles) {
    throw data(null, { status: 400 });
  }

  // Ensure that none of the files being uploaded have already been uploaded.
  if ([...files.keys()].some((id) => uploadState.uploadedDocuments.some((document) => document.id === id))) {
    throw data(null, { status: 409 });
  }

  // Validate the upload form against the schema.
  const validationResult = validateUploadedFiles({ files, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, responseType: 'validation-errors', errors: validationResult.errors } as const, 400);
  }

  // Extract the submitted documents from the validated form data.
  const submittedDocuments = Object.entries(validationResult.data.files).map(([fileId, { file, documentType }]) => {
    return { id: fileId, fileName: file.name, documentType, fileSize: file.size };
  });

  updateDocumentUploadState({ id: uploadState.id, session, params, state: { pendingDocuments: submittedDocuments, uploadedDocuments: uploadState.uploadedDocuments } });

  const scanResult = await scanDocuments(validationResult.data.files);
  if (!scanResult.success) {
    return data({ formAction, source, responseType: 'scan-errors', errors: scanResult.errors } as const, 400);
  }

  const uploadResult = await uploadDocuments(validationResult.data.files);
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
  finishDocumentUploadState({ id: uploadState.id, session, params });
  return redirect(getDocumentUploadSubmittedUrl(uploadState.id, params));
}

/**
 * Checks for file-level upload errors associated with a submitted document.
 * @param fileId - The submitted file ID.
 * @param uploadDocumentsFailureResponse - The failed batch upload response.
 * @returns Whether the response contains file-level errors for this ID.
 */
function hasUploadError(fileId: string, uploadDocumentsFailureResponse: UploadDocumentsResponseFailure): boolean {
  return (uploadDocumentsFailureResponse.errors.properties?.files?.properties?.[fileId]?.properties?.file?.errors.length ?? 0) > 0;
}
