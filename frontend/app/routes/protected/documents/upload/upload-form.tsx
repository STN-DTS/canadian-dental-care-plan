import type { JSX } from 'react';

import type { ShouldRevalidateFunction } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/upload-form';

import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { pageIds } from '~/page-ids';
import { DocumentUploadForm } from '~/routes/protected/documents/upload/components/upload-form';
import { DocumentUploadInstructions } from '~/routes/protected/documents/upload/components/upload-instructions';
import { FORM_ACTION } from '~/routes/protected/documents/upload/upload-form-action';
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

export { middleware } from '~/routes/protected/documents/upload/upload-form-middleware.server';
export { clientAction } from '~/routes/protected/documents/upload/upload-form-action.client';
export { action } from '~/routes/protected/documents/upload/upload-form-action.server';
export { loader } from '~/routes/protected/documents/upload/upload-form-loader.server';

/**
 * Preserves the active flow after same-page upload form mutations without changing navigation resets.
 * @param args - The navigation, submission, and default revalidation decision.
 * @returns False for known same-page POST actions, otherwise the router's default decision.
 */
export const shouldRevalidate: ShouldRevalidateFunction = ({ currentUrl, nextUrl, formAction, formData, formMethod, defaultShouldRevalidate }) => {
  if (formMethod?.toUpperCase() !== 'POST' || !formAction) return defaultShouldRevalidate;

  const isSamePage = currentUrl.pathname === nextUrl.pathname && currentUrl.search === nextUrl.search && new URL(formAction, currentUrl).pathname === currentUrl.pathname;
  const isUploadFormAction = Object.values(FORM_ACTION).some((action) => action === formData?.get('_action'));
  return isSamePage && isUploadFormAction ? false : defaultShouldRevalidate;
};

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
