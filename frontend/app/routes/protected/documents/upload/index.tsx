import type { JSX } from 'react';

import { data } from 'react-router';

import { getI18n, useTranslation } from 'react-i18next';
import * as z from 'zod';

import type { Route } from './+types/index';

import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { pageIds } from '~/page-ids';
import { validateFileSelection, validateUploadForm } from '~/route-helpers/protected-documents-upload-helpers';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/document-upload-form';
import { DocumentUploadInstructions } from '~/routes/protected/documents/upload/document-upload-instructions';
import { FORM_ACTION } from '~/routes/protected/documents/upload/form-actions';
import { getLanguage } from '~/utils/locale-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export { action, loader, middleware } from './upload.server';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.upload,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  return <ProtectedBreadcrumbs />;
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function clientAction({ request, url, serverAction }: Route.ClientActionArgs) {
  const locale = getLanguage(url);
  const t = getI18n().getFixedT(locale, 'documents');
  const formData = await request.clone().formData();
  const source = 'client';

  const formAction = z.enum(FORM_ACTION).parse(formData.get('_action'));

  if (formAction === FORM_ACTION.addFiles) {
    const selectionValidationResult = validateFileSelection({ formData, locale, t });
    const validationId = selectionValidationResult.validationId;

    if (!selectionValidationResult.success) {
      return data({ formAction, source, validationId, errors: selectionValidationResult.errors }, 400);
    }

    return { formAction, source, validationId, errors: undefined };
  }

  const validationResult = await validateUploadForm({ formData, locale, t });
  if (!validationResult.success) {
    return data({ formAction, source, errors: validationResult.errors }, 400);
  }

  return await serverAction();
}

export default function DocumentsUpload({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation(['documents', 'gcweb']);
  const { documentTypes, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.upload.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-8">
        <DocumentUploadInstructions />
        <section className="space-y-4">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.upload.uploadFiles.title)}</h2>
          <DocumentUploadForm documentTypes={documentTypes} />
        </section>
        <div>
          <ButtonLink
            id="back-button"
            variant="secondary"
            to={t(($) => $.header.menuDashboardHref, {
              baseUri: SCCH_BASE_URI,
              ns: 'gcweb',
            })}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Upload my documents click"
          >
            {t(($) => $.index.returnDashboard)}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
