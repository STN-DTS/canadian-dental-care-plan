import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/unable-to-process-request';

import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { InlineLink } from '~/components/inline-link';
import { PublicLayout } from '~/components/layouts/public-layout';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  i18nPreloadNamespace: ['unableToProcessRequest', 'gcweb'],
  pageIdentifier: pageIds.public.unableToProcessRequest,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ request, url }: Route.LoaderArgs) {
  const t = await getFixedT(url, ['unableToProcessRequest', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.pageTitle) }),
  };

  return { meta };
}

export default function UnableToProcessRequest({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('unableToProcessRequest');

  const noWrap = <span className="whitespace-nowrap" />;
  const eServiceCanadaLink = <InlineLink to={t(($) => $.eServiceCanadaLink)} className="external-link" newTabIndicator target="_blank" />;
  const cdcpLink = <InlineLink to={t(($) => $.cdcpLink)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <PublicLayout>
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
    </PublicLayout>
  );
}
