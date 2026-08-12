import type { JSX } from 'react';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/not-required';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale-utils';
import type { IdToken } from '~/.server/utils/raoidc-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ProtectedBreadcrumbs } from '~/components/breadcrumbs';
import { ButtonLink } from '~/components/buttons';
import { InlineLink } from '~/components/inline-link';
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

  const statusCheckerLink = <InlineLink routeId="public/status/index" params={params} className="external-link" newTabIndicator target="_blank" />;
  const lettersLink = <InlineLink routeId="protected/letters/index" params={params} />;

  return (
    <>
      <AppPageTitle>{t(($) => $.notRequired.pageTitle)}</AppPageTitle>
      <div className="space-y-6">
        <p>{t(($) => $.notRequired.description)}</p>
        <div className="space-y-4">
          <p>{t(($) => $.notRequired.reasonsHeading)}</p>
          <ul className="list-disc space-y-1 pl-7">
            <li>{t(($) => $.notRequired.reasons.processing)}</li>
            <li>{t(($) => $.notRequired.reasons.processed)}</li>
            <li>{t(($) => $.notRequired.reasons.cancelled)}</li>
          </ul>
        </div>
        <div className="space-y-4">
          <h2 className="font-lato text-2xl font-bold">{t(($) => $.notRequired.whatYouCanDoHeading)}</h2>
          <ul className="list-disc space-y-1 pl-7">
            <li>
              <Trans ns="documents" i18nKey={($) => $.notRequired.statusChecker} components={{ statusCheckerLink }} />
            </li>
            <li>
              <Trans ns="documents" i18nKey={($) => $.notRequired.letters} components={{ lettersLink }} />
            </li>
          </ul>
        </div>
      </div>
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
