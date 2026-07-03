import { redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/dental-insurance-exit-application';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearPublicApplicationState, getPublicApplicationState, validateApplicationFlow } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
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
  pageIdentifier: pageIds.public.application.spokes.dentalInsuranceExitApplication,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family']);

  const t = await getFixedT(request, ['applicationSpokes', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.dentalInsuranceExitApplication.pageTitle) }),
  };
  return { meta };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const state = getPublicApplicationState({ params, session });
  validateApplicationFlow(state, params, ['full-adult', 'full-children', 'full-family', 'simplified-adult', 'simplified-family']);

  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'applicationSpokes');

  clearPublicApplicationState({ params, session });

  return redirect(t(($) => $.dentalInsuranceExitApplication.exitLink));
}

export default function ApplicationSpokeDentalInsuranceExitApplication({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('applicationSpokes');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  return (
    <>
      <AppPageTitle>{t(($) => $.dentalInsuranceExitApplication.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-8 space-y-4">
          <p>{t(($) => $.dentalInsuranceExitApplication.areYouSure)}</p>
          <p>{t(($) => $.dentalInsuranceExitApplication.clickBack)}</p>
        </div>
        <fetcher.Form method="post" noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId="public/application/$id/dental-insurance"
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Exiting the application click"
          >
            {t(($) => $.dentalInsuranceExitApplication.backBtn)}
          </ButtonLink>
          <LoadingButton variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Exit - Exiting the application click">
            {t(($) => $.dentalInsuranceExitApplication.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
