import { data, replace } from 'react-router';

import { ATTR_OTEL_EVENT_NAME } from '@opentelemetry/semantic-conventions';
// session.id is currently an incubating OpenTelemetry convention.
import { ATTR_SESSION_ID } from '@opentelemetry/semantic-conventions/incubating';
import type { TFunction } from 'i18next';
import * as z from 'zod';

import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import {
  ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_NUMBER,
  ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_OUTCOME,
  ATTR_CDCP_DOCUMENT_UPLOAD_FILES_FAILED_COUNT,
  ATTR_CDCP_DOCUMENT_UPLOAD_FILES_SUBMITTED_COUNT,
  ATTR_CDCP_DOCUMENT_UPLOAD_FILES_UPLOADED_COUNT,
  ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ATTEMPT_COUNT,
  ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ID,
  ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_UPLOADED_TOTAL,
} from '~/.server/logging/log-attributes';
import { finishDocumentUploadState, getDocumentUploadSubmittedUrl, loadDocumentUploadState, recordDocumentUploadAttempt, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import type { DocumentUploadState, SubmittedDocument } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import type { Session } from '~/.server/web/session';
import { getFiles, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { uploadDocuments, validateDocumentContents } from '~/route-helpers/protected-documents-upload-helpers.server';
import type { UploadDocumentsResponseFailure } from '~/route-helpers/protected-documents-upload-helpers.server';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import type { FormAction } from '~/routes/protected/documents/upload/upload-form-action';

import type { Route } from './+types/upload-form';

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

  const uploadedDocuments = uploadState.documents.filter((document) => document.status === 'uploaded');

  if (uploadState.status === 'finished' || uploadedDocuments.length === 0) {
    throw data(null, { status: 409 });
  }

  updateDocumentUploadState({ id: uploadState.id, session, params, state: { documents: uploadedDocuments } });
  finishDocumentUploadState({ id: uploadState.id, session, params });
  logFlowFinished({ attemptCount: uploadState.uploadAttemptCount ?? 0, flowId: uploadState.id, session, uploadedTotal: uploadedDocuments.length });
  return replace(getDocumentUploadSubmittedUrl(uploadState.id, params));
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
 * Validates and uploads the submitted pending batch, preserving earlier successful uploads.
 * Records the validated batch as pending before content checking; EWDU scans during upload.
 * @param args - The upload action, submitted fields, locale, route parameters, session, translator, and flow.
 * @returns A tagged validation, content-check, or upload error response, or a redirect after completion.
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
  if ([...files.keys()].some((id) => uploadState.documents.some((document) => document.id === id && document.status === 'uploaded'))) {
    throw data(null, { status: 409 });
  }

  const previouslyUploadedTotal = uploadState.documents.filter((document) => document.status === 'uploaded').length;

  // Validate the upload form against the schema.
  const validationResult = validateUploadedFiles({ files, locale, t });

  if (!validationResult.success) {
    return data({ formAction, source, responseType: 'validation-errors', errors: validationResult.errors } as const, 400);
  }

  // Extract the submitted documents from the validated form data.
  const submittedDocuments: SubmittedDocument[] = Object.entries(validationResult.data.files).map(([fileId, { file, documentType }]) => {
    return { id: fileId, fileName: file.name, documentType, fileSize: file.size, status: 'pending' as const };
  });

  const existingIds = new Set(uploadState.documents.map(({ id }) => id));
  const submittedDocumentsById = new Map(submittedDocuments.map((document) => [document.id, document]));
  const documents = [
    ...uploadState.documents.filter((document) => document.status === 'uploaded' || submittedDocumentsById.has(document.id)).map((document) => submittedDocumentsById.get(document.id) ?? document),
    ...submittedDocuments.filter((document) => !existingIds.has(document.id)),
  ];

  updateDocumentUploadState({ id: uploadState.id, session, params, state: { documents } });

  const contentValidationResult = await validateDocumentContents(validationResult.data.files);

  if (!contentValidationResult.success) {
    return data({ formAction, source, responseType: 'content-validation-errors', errors: contentValidationResult.errors } as const, 400);
  }

  const attemptNumber = recordDocumentUploadAttempt({ id: uploadState.id, session, params });
  const uploadResult = await uploadDocuments(validationResult.data.files);

  const processedDocuments = documents.map((document) => {
    if (document.status === 'uploaded' || (!uploadResult.success && hasUploadError(document.id, uploadResult))) {
      return document;
    }

    return Object.assign({}, document, { status: 'uploaded' as const, uploadDate: uploadResult.uploadDates[document.id] });
  });

  updateDocumentUploadState({ id: uploadState.id, session, params, state: { documents: processedDocuments } });

  const uploadedTotal = processedDocuments.filter((document) => document.status === 'uploaded').length;

  logUploadAttempt({
    attemptNumber,
    flowId: uploadState.id,
    session,
    submittedCount: Object.keys(validationResult.data.files).length,
    outcome: uploadResult.success ? 'uploaded' : 'upload_failed',
    uploadedCount: uploadedTotal - previouslyUploadedTotal,
    uploadedTotal,
  });

  if (!uploadResult.success) {
    return data(
      {
        formAction,
        source,
        responseType: 'upload-errors',
        errors: uploadResult.errors,
        documents: processedDocuments,
      } as const,
      400,
    );
  }

  finishDocumentUploadState({ id: uploadState.id, session, params });
  logFlowFinished({ attemptCount: attemptNumber, flowId: uploadState.id, session, uploadedTotal });
  return replace(getDocumentUploadSubmittedUrl(uploadState.id, params));
}

type UploadAttemptOutcome = 'uploaded' | 'upload_failed';

type LogUploadAttemptParams = {
  attemptNumber: number;
  flowId: string;
  outcome: UploadAttemptOutcome;
  session: Session;
  submittedCount: number;
  uploadedCount: number;
  uploadedTotal: number;
};

/**
 * Logs the file counts of one upload submission. Downstream upload failures log at warn; all other outcomes log at info.
 * @param args - The attempt number, flow ID, outcome, session, and file counts.
 */
function logUploadAttempt({ attemptNumber, flowId, outcome, session, submittedCount, uploadedCount, uploadedTotal }: LogUploadAttemptParams) {
  const log = createLogger('upload-form-action.server/uploadAction');
  const attributes = {
    [ATTR_OTEL_EVENT_NAME]: 'cdcp.document_upload.attempt.completed',
    [ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_NUMBER]: attemptNumber,
    [ATTR_CDCP_DOCUMENT_UPLOAD_ATTEMPT_OUTCOME]: outcome,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FILES_FAILED_COUNT]: submittedCount - uploadedCount,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FILES_SUBMITTED_COUNT]: submittedCount,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FILES_UPLOADED_COUNT]: uploadedCount,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ID]: flowId,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_UPLOADED_TOTAL]: uploadedTotal,
    [ATTR_SESSION_ID]: session.id,
  };

  if (outcome === 'upload_failed') {
    log.warn('Document upload attempt completed with failed files', attributes);
    return;
  }

  log.info('Document upload attempt completed', attributes);
}

type LogFlowFinishedParams = {
  attemptCount: number;
  flowId: string;
  session: Session;
  uploadedTotal: number;
};

/**
 * Logs the totals of a finished upload flow.
 * @param args - The attempt count, flow ID, session, and uploaded file total.
 */
function logFlowFinished({ attemptCount, flowId, session, uploadedTotal }: LogFlowFinishedParams) {
  const log = createLogger('upload-form-action.server/finishFlow');
  log.info('Document upload flow finished', {
    [ATTR_OTEL_EVENT_NAME]: 'cdcp.document_upload.flow.finished',
    [ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ATTEMPT_COUNT]: attemptCount,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_ID]: flowId,
    [ATTR_CDCP_DOCUMENT_UPLOAD_FLOW_UPLOADED_TOTAL]: uploadedTotal,
    [ATTR_SESSION_ID]: session.id,
  });
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
