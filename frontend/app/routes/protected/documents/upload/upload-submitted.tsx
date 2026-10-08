import type { JSX } from 'react';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/upload-submitted';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getUser } from '~/.server/context/user-context';
import { loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { ContextualAlert } from '~/components/contextual-alert';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.submitted,
} as const satisfies RouteHandleData;

function LayoutBreadcrumbs(): JSX.Element {
  return <ProtectedBreadcrumbs />;
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export { middleware } from '~/routes/protected/documents/upload/upload-submitted-middleware.server';

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);

  const { documents } = loadDocumentUploadState({ id: params.id, params, session });
  const uploadedDocuments = documents.filter((document) => document.status === 'uploaded');

  const t = await getFixedT(url, ['documents', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.submitted.pageTitle) }),
  };

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const user = getUser(context);
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-submitted', { userId: user.id });

  return { meta, uploadedDocuments, SCCH_BASE_URI };
}

export default function DocumentsSubmitted({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation(['documents', 'gcweb']);
  const { uploadedDocuments, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.submitted.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-6">
        <ContextualAlert type="success">
          <div className="space-y-2">
            <h2 className="font-lato mb-2 text-xl font-semibold">{t(($) => $.submitted.alertHeading)}</h2>
            <p>{t(($) => $.submitted.youSubmitted)}</p>
            <ol className="list-decimal space-y-1 pl-7">
              {uploadedDocuments.map((document) => (
                <li key={document.id}>{document.fileName}</li>
              ))}
            </ol>
            <p>{t(($) => $.submitted.delayNote)}</p>
          </div>
        </ContextualAlert>
        <section className="space-y-4">
          <h2 className="font-lato text-2xl font-semibold">{t(($) => $.submitted.nextStepsHeading)}</h2>
          <ul className="list-disc space-y-1 pl-7">
            <li>{t(($) => $.submitted.nextSteps.review)}</li>
            <li>{t(($) => $.submitted.nextSteps.letter)}</li>
          </ul>
        </section>
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink
            id="return-button"
            variant="primary"
            to={t(($) => $.header.menuDashboardHref, {
              baseUri: SCCH_BASE_URI,
              ns: 'gcweb',
            })}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Documents submitted button click"
          >
            {t(($) => $.submitted.returnButton)}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
