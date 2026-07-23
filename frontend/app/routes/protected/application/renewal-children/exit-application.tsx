import { redirect, useFetcher } from 'react-router';

import { faChevronLeft } from '@fortawesome/free-solid-svg-icons';
import { useTranslation } from 'react-i18next';

import type { Route } from './+types/exit-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { loadProtectedApplicationRenewalChildState } from '~/.server/routes/helpers/protected-application-renewal-child-route-helpers';
import { clearProtectedApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { LoadingButton } from '~/components/loading-button';
import { useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.renewalChild.exitApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const t = await getFixedT(url, ['protectedApplicationRenewalChild', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.exitApplication.pageTitle) }),
  };
  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = loadProtectedApplicationRenewalChildState({ params, requestUrl: url, session });
  validateApplicationFlow(state, params, ['renewal-children']);

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplicationRenewalChild');

  clearProtectedApplicationState({ params, session });

  return redirect(t(($) => $.exitApplication.exitLink));
}

export default function ProtectedRenewChildrenExitApplication({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplicationRenewalChild');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  return (
    <>
      <AppPageTitle>{t(($) => $.exitApplication.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-8 space-y-4">
          <p>{t(($) => $.exitApplication.areYouSure)}</p>
          <p>{t(($) => $.exitApplication.clickBack)}</p>
        </div>
        <fetcher.Form method="post" noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId="protected/application/$id/renewal-children/submit"
            params={params}
            disabled={isSubmitting}
            startIcon={faChevronLeft}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Back - Exiting the application click"
          >
            {t(($) => $.exitApplication.backBtn)}
          </ButtonLink>
          <LoadingButton variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Renewal_Child:Exit - Exiting the application click">
            {t(($) => $.exitApplication.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
