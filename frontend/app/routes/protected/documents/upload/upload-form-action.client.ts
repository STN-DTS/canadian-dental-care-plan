import { data } from 'react-router';

import { getI18n } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/upload-form';

import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
import { getLanguage } from '~/utils/locale-utils';

export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');
  const formData = await request.clone().formData();
  const source = 'client' as const;

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.addFiles) {
    const selectionValidationResult = validateFileSelection({ formData, locale, t });
    const validationId = selectionValidationResult.validationId;

    if (!selectionValidationResult.success) {
      return data({ formAction, source, validationId, responseType: 'validation-errors', errors: selectionValidationResult.errors } as const, 400);
    }

    return { formAction, source, validationId, responseType: 'success', errors: undefined } as const;
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, responseType: 'validation-errors', errors: validationResult.errors } as const, 400);
  }

  return await serverAction();
}
