import type { JSX } from 'react';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/submitted';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getDocumentUploadStateIdFromUrl, loadDocumentUploadState } from '~/.server/routes/helpers/document-upload-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
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
  const { t } = useTranslation('documents');
  return (
    <ProtectedBreadcrumbs
      items={[
        {
          content: t(($) => $.index.pageTitle),
          routeId: 'protected/documents/index',
        },
      ]}
    />
  );
}

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('doc-upload');
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const documentUploadStateId = getDocumentUploadStateIdFromUrl(url);
  const { submittedDocuments } = loadDocumentUploadState({ id: documentUploadStateId, params, session });

  const t = await getFixedT(url, ['documents', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.submitted.pageTitle) }),
  };

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-submitted', { userId: idToken.sub });

  return { meta, submittedDocuments, SCCH_BASE_URI };
}

export default function DocumentsSubmitted({ loaderData }: Route.ComponentProps) {
  const { t } = useTranslation(['documents', 'gcweb']);
  const { submittedDocuments, SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.submitted.pageTitle)}</AppPageTitle>
      <div className="max-w-prose space-y-6">
        <ContextualAlert type="success">
          <h2 className="mb-2 font-bold">{t(($) => $.submitted.alertHeading)}</h2>
          <p className="mb-2">{t(($) => $.submitted.youSubmitted)}</p>
          <ul className="list-none space-y-1">
            {submittedDocuments.map((document) => (
              <li key={document}>{document}</li>
            ))}
          </ul>
          <p className="mt-2">{t(($) => $.submitted.delayNote)}</p>
        </ContextualAlert>
        <section className="space-y-4">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.submitted.nextStepsHeading)}</h2>
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
