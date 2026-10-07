import type { JSX } from 'react';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/upload-form';

import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { pageIds } from '~/page-ids';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { DocumentUploadInstructions } from '~/routes/protected/documents/upload/components/upload-instructions';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.upload,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  return <ProtectedBreadcrumbs />;
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export { loader } from './upload-form-loader.server';
export { action } from './upload-form-action.server';
export { clientAction } from './upload-form-action.client';

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
