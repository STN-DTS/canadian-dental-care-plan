import { redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/renewal-submitted';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getFixedT } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { InlineLink } from '~/components/inline-link';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalSubmitted,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.renewalSubmitted.pageTitle) }),
  };

  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const formData = await request.formData();
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplication');
  return redirect(t(($) => $.renewalSubmitted.exitBtnLink));
}

export default function RenewalApplicationSubmitted({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplication');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const noWrap = <span className="whitespace-nowrap" />;
  const statusCheckerLink = <InlineLink routeId="public/status/index" className="external-link" newTabIndicator target="_blank" params={params} />;
  const mscaLinkAccount = <InlineLink to={t(($) => $.renewalSubmitted.mscaLinkAccount)} className="external-link" newTabIndicator target="_blank" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.renewalSubmitted.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-6 space-y-4">
          <p>{t(($) => $.renewalSubmitted.recordsShowApplicationSubmitted)}</p>
          <p>
            <Trans ns="protectedApplication" i18nKey={($) => $.renewalSubmitted.statusCheckerInfo} components={{ statusCheckerLink }} />
          </p>
          <p>
            <Trans ns="protectedApplication" i18nKey={($) => $.renewalSubmitted.updateProfileInfo} components={{ mscaLinkAccount, noWrap }} />
          </p>
        </div>
        <fetcher.Form method="post" noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <LoadingButton type="submit" variant="primary" id="proceed-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Exit - Renewal application submitted click">
            {t(($) => $.renewalSubmitted.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
