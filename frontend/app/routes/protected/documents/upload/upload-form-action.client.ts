import { data } from 'react-router';

import type { TFunction } from 'i18next';
import { getI18n } from 'react-i18next';
import * as z from 'zod';

import { getFiles, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import type { FormAction } from '~/routes/protected/documents/upload/upload-form-action';
import { getLanguage } from '~/utils/locale-utils';

import type { Route } from './+types/upload-form';

const source = 'client' as const;

/**
 * Validates files before upload and forwards other actions to the server.
 * @param args - The request, localized URL, and server action callback.
 * @returns A client upload-validation response or the server action result.
 */
export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');

  const formData = await request.clone().formData();
  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.upload) {
    return await uploadAction({ formAction, formData, locale, serverAction, t });
  }

  // other form actions
  return await serverAction();
}

type UploadActionArgs = {
  formAction: FormAction;
  formData: FormData;
  locale: string;
  serverAction: Route.ClientActionArgs['serverAction'];
  t: TFunction<'documents'>;
};

/**
 * Parses and validates pending files before delegating their upload to the server.
 * @param args - The upload action, submitted fields, locale, translator, and server callback.
 * @returns An HTTP 400 validation response or the server action result.
 * @throws If the action is not `upload` or file parsing fails.
 */
async function uploadAction({ formAction, formData, locale, serverAction, t }: UploadActionArgs) {
  if (formAction !== FORM_ACTION.upload) {
    throw new Error('Invalid form action for uploadAction');
  }

  const files = await getFiles(formData);
  const validationResult = validateUploadedFiles({ files, locale, t });

  if (!validationResult.success) {
    return data({ formAction, source, responseType: 'validation-errors', errors: validationResult.errors } as const, 400);
  }

  // At this point, all validations have passed, and we can proceed with the server action.
  return await serverAction();
}
