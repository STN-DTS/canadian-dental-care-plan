import { data } from 'react-router';

import type { TFunction } from 'i18next';
import { getI18n } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/upload-form';

import { getFiles, validateFileSelection, validateUploadedFiles } from '~/route-helpers/protected-documents-upload-helpers';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import type { FormAction } from '~/routes/protected/documents/upload/upload-form-action';
import { getLanguage } from '~/utils/locale-utils';

const source = 'client' as const;

/**
 * Dispatches selection validation and upload validation, forwarding other actions to the server.
 * @param args - The request, localized URL, and server action callback.
 * @returns A client validation response or the server action result.
 */
export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');

  const formData = await request.clone().formData();
  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.addFiles) {
    return await addFilesAction({ formAction, formData, locale, t });
  }

  if (formAction === FORM_ACTION.upload) {
    return await uploadAction({ formAction, formData, locale, serverAction, t });
  }

  // other form actions
  return await serverAction();
}

type AddFilesActionArgs = {
  formAction: FormAction;
  formData: FormData;
  locale: string;
  t: TFunction<'documents'>;
};

/**
 * Validates a proposed file selection without invoking the server action.
 * @param args - The selection action, submitted fields, locale, and translator.
 * @returns A validation-ID-tagged success or HTTP 400 validation response.
 * @throws If the action is not `add-files` or selection parsing fails.
 */
async function addFilesAction({ formAction, formData, locale, t }: AddFilesActionArgs) {
  if (formAction !== FORM_ACTION.addFiles) {
    throw new Error('Invalid form action for addFilesAction');
  }

  const selectionValidationResult = await validateFileSelection({ formData, locale, t });
  const validationId = selectionValidationResult.validationId;

  if (!selectionValidationResult.success) {
    return data({ formAction, source, validationId, responseType: 'validation-errors', errors: selectionValidationResult.errors } as const, 400);
  }

  return { formAction, source, validationId, responseType: 'success', errors: undefined } as const;
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
