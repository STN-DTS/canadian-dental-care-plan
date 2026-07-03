import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/unable-to-process-request';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale.utils';
import type { IdToken } from '~/.server/utils/raoidc.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { InlineLink } from '~/components/inline-link';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['unableToProcessRequest', 'gcweb'],
  pageIdentifier: pageIds.protected.unableToProcessRequest,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const t = await getFixedT(request, ['unableToProcessRequest', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.mscaTemplate, { ns: 'gcweb', title: t(($) => $.pageTitle) }),
  };

  const idToken: IdToken = session.get('idToken');
  appContainer.get(TYPES.AuditService).createAudit('page-view.renew.unable-to-process-request', { userId: idToken.sub });

  return { meta };
}

export default function ProtectedUnableToProcessRequest({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('unableToProcessRequest');

  const noWrap = <span className="whitespace-nowrap" />;
  const eServiceCanadaLink = <InlineLink to={t(($) => $.eServiceCanadaLink)} className="external-link" newTabIndicator target="_blank" />;
  const cdcpLink = <InlineLink to={t(($) => $.cdcpLink)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="space-y-4">
          <p>{t(($) => $.unableToProcess)}</p>
          <p>{t(($) => $.tryAgain)}</p>
          <ul className="list-disc space-y-1 pl-7">
            <li>{t(($) => $.disableVpn)}</li>
            <li>{t(($) => $.anotherDevice)}</li>
          </ul>
          <p>{t(($) => $.difficulties)}</p>
          <ul className="list-disc space-y-1 pl-7">
            <li>
              <Trans ns="unableToProcessRequest" i18nKey={($) => $.callCentre} components={{ noWrap }} />
            </li>
            <li>{t(($) => $.visitCentre)}</li>
            <li>
              <Trans ns="unableToProcessRequest" i18nKey={($) => $.submitRequest} components={{ eServiceCanadaLink }} />
            </li>
          </ul>
          <p>
            <Trans ns="unableToProcessRequest" i18nKey={($) => $.returnCdcp} components={{ cdcpLink }} />
          </p>
        </div>
      </div>
    </>
  );
}
