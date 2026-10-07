import { data, redirect } from 'react-router';

import * as z from 'zod';

import type { Route } from './+types/upload-form';

import { appContext } from '~/.server/context';
import { getDocumentUploadSubmittedUrl, updateDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale-utils';
import { validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { scanDocuments, uploadDocuments } from '~/route-helpers/protected-documents-upload-helpers.server';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';

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

  updateDocumentUploadState({ id, session, params, state: { submittedDocuments, pendingDocuments: [] } });

  return redirect(getDocumentUploadSubmittedUrl(id, params));
}
