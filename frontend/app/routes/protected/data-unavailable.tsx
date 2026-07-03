import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/data-unavailable';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import type { IdToken } from '~/.server/utils/raoidc.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['dataUnavailable', 'gcweb'],
  pageIdentifier: pageIds.protected.dataUnavailable,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const t = await getFixedT(request, ['dataUnavailable', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.pageTitle) }),
  };

  const { SCCH_BASE_URI } = appContainer.get(TYPES.ClientConfig);

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.renew.data-unavailable', { userId: idToken.sub });

  return { meta, SCCH_BASE_URI };
}

export default function DataUnavailable({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation(['dataUnavailable', 'gcweb']);
  const { SCCH_BASE_URI } = loaderData;

  const statusCheckerLink = <InlineLink routeId="public/status/index" className="external-link" newTabIndicator target="_blank" params={params} />;
  const cdcpLink = <InlineLink to={t(($) => $.doYouQualifyHref)} className="external-link" newTabIndicator target="_blank" />;
  const contactLink = <InlineLink to={t(($) => $.contactUsHref)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="space-y-4">
          <p>
            <Trans ns="dataUnavailable" i18nKey={($) => $.serviceEligible} components={{ statusCheckerLink }} />
          </p>
          <p>
            <Trans ns="dataUnavailable" i18nKey={($) => $.otherEnquiry} components={{ cdcpLink }} />
          </p>
          <p>
            <Trans ns="dataUnavailable" i18nKey={($) => $.serviceDelay} components={{ contactLink }} />
          </p>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <ButtonLink
            id="back-button"
            to={t(($) => $.header.menuDashboardHref, { ns: 'gcweb', baseUri: SCCH_BASE_URI })}
            variant="primary"
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Applications:Return to dashboard - You have not applied for CDCP click"
          >
            {t(($) => $.backButton)}
          </ButtonLink>
        </div>
      </div>
    </>
  );
}
