import type { JSX } from 'react';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/not-required';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['documents', 'gcweb'],
  layoutOptions: { breadcrumbs: <LayoutBreadcrumbs /> },
  pageIdentifier: pageIds.protected.documents.notRequired,
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

export async function loader({ context, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateFeatureEnabled('doc-upload');
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const t = await getFixedT(url, ['documents', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.notRequired.pageTitle) }),
  };

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.documents-not-required', { userId: idToken.sub });

  return { meta, SCCH_BASE_URI };
}

export default function NotRequired({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['documents', 'gcweb']);
  const { SCCH_BASE_URI } = loaderData;

  return (
    <>
      <AppPageTitle>{t(($) => $.notRequired.pageTitle)}</AppPageTitle>
      <p>{t(($) => $.notRequired.description)}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <ButtonLink
          id="back-button"
          variant="primary"
          to={t(($) => $.header.menuDashboardHref, {
            baseUri: SCCH_BASE_URI,
            ns: 'gcweb',
          })}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Applicant Documents-Protected:Return to dashboard - Documents not required button click"
        >
          {t(($) => $.notRequired.returnButton)}
        </ButtonLink>
      </div>
    </>
  );
}
