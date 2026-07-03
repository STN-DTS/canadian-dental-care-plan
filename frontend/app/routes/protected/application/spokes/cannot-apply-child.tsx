import { redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/cannot-apply-child';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearProtectedApplicationState, getSingleChildState } from '~/.server/routes/helpers/protected-application-route-helpers';
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
  pageIdentifier: pageIds.protected.application.spokes.cannotApplyChild,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  getSingleChildState({ params, session });
  const t = await getFixedT(request, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.children.cannotApplyChild.pageTitle) }),
  };

  return { meta };
}

export async function action({ context, params, request }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ request, session });

  const formData = await request.formData();

  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(request, 'protectedApplicationSpokes');

  clearProtectedApplicationState({ params, session });

  return redirect(t(($) => $.children.cannotApplyChild.exitBtnLink));
}

export default function CannotApplyChild({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplicationSpokes');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const noWrap = <span className="whitespace-nowrap" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.children.cannotApplyChild.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-6 space-y-4">
          <p>{t(($) => $.children.cannotApplyChild.ineligibleToApply)}</p>
          <p>
            <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.children.cannotApplyChild.eligibilityInfo} components={{ noWrap }} />
          </p>
        </div>
        <fetcher.Form method="post" noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId="protected/application/$id/children/$childId/information"
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Child apply for yourself click"
          >
            {t(($) => $.children.cannotApplyChild.backBtn)}
          </ButtonLink>
          <LoadingButton type="submit" variant="primary" id="proceed-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Exit - Child apply for yourself click">
            {t(($) => $.children.cannotApplyChild.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
