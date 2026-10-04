import { data, redirect } from 'react-router';

import * as z from 'zod';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getApplicant } from '~/.server/context/applicant-context';
import { getUser } from '~/.server/context/user-context';
import { getDocumentUploadSubmittedUrl, startDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { EVIDENTIARY_DOCUMENT_TYPE_STATUS } from '~/constants/evidentiary-document-type';
import { validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { FORM_ACTION } from '~/routes/protected/documents/upload/form-actions';
import { getPathById } from '~/utils/route-utils';

/**
 * Middleware that permits access to the document upload route only for eligible applicants.
 *
 * Applicants must have at least one application paused due to a T4 mismatch. Ineligible
 * applicants are redirected to the not-required page.
 */
const appealUploadEligibilityMiddleware: Route.MiddlewareFunction = async ({ context, params }) => {
  const { appContainer } = context.get(appContext);
  const applicant = getApplicant(context);

  const appealUploadEligibilityService = appContainer.get(TYPES.AppealUploadEligibilityService);
  const appealUploadEligibility = await appealUploadEligibilityService.findAppealUploadEligibility(applicant.clientNumber);
  const canUploadAppealDocuments = appealUploadEligibility.isSome() && appealUploadEligibility.unwrap().canUploadAppealDocuments;

  if (!canUploadAppealDocuments) {
    throw redirect(getPathById('protected/documents/not-required', params));
  }
};

export const middleware: Route.MiddlewareFunction[] = [appealUploadEligibilityMiddleware];

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);

  const locale = getLocale(url);
  const t = await getFixedT(url, ['documents', 'gcweb']);

  const documentTypes = await appContainer.get(TYPES.EvidentiaryDocumentTypeService).listLocalizedEvidentiaryDocumentTypesByStatus(EVIDENTIARY_DOCUMENT_TYPE_STATUS.active, locale);

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const user = getUser(context);
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-upload', { userId: user.id });

  return {
    meta: { title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.upload.pageTitle) }) },
    documentTypes,
    SCCH_BASE_URI,
  };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { session } = context.get(appContext);
  const locale = getLocale(url);
  const t = await getFixedT(locale, 'documents');
  const formData = await request.formData();
  const source = 'server';

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));
  if (formAction !== FORM_ACTION.upload) {
    throw new Error(`Invalid formAction: ${formAction}`);
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, errors: validationResult.errors } as const, 400);
  }

  const { files } = validationResult.data;

  const scanResult = await scanDocuments(files);
  if (!scanResult.success) {
    return data({ formAction, source, errors: scanResult.errors } as const, 400);
  }

  const uploadResult = await uploadDocuments(files);
  if (!uploadResult.success) {
    return data({ formAction, source, errors: uploadResult.errors } as const, 400);
  }

  const id = crypto.randomUUID();
  const submittedDocuments = Object.entries(files).map(([fileId, { file, documentType }]) => {
    return { id: fileId, fileName: file.name, documentType, fileSize: file.size };
  });

  startDocumentUploadState({ id, session, submittedDocuments });

  return redirect(getDocumentUploadSubmittedUrl({ id, params }));
}
