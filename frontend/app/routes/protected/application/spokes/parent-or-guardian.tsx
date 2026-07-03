import { redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/parent-or-guardian';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearProtectedApplicationState, getContextualAgeCategoryFromDate, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { LoadingButton } from '~/components/loading-button';
import { useApplicationFlowStorage, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.protected.application.spokes.parentOrGuardian,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const state = getProtectedApplicationState({ params, session });
  const t = await getFixedT(url, ['protectedApplicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.parentOrGuardian.pageTitle) }),
  };

  invariant(state.applicantInformation, 'Expected state.applicantInformation to be defined');
  const ageCategory = getContextualAgeCategoryFromDate(state.applicantInformation.dateOfBirth, state.applicationYear);

  if (ageCategory !== 'children' && ageCategory !== 'youth') {
    const redirectUrl =
      state.context === 'intake' //
        ? getPathById('protected/application/$id/personal-information', params)
        : getPathById('protected/application/$id/renewal-selection', params);
    return redirect(redirectUrl);
  }

  return { ageCategory, context: state.context, meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplicationSpokes');

  clearProtectedApplicationState({ params, session });

  return redirect(t(($) => $.parentOrGuardian.exitBtnLink));
}

export default function ApplyFlowParentOrGuardian({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplicationSpokes');
  const { ageCategory, context } = loaderData;
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const noWrap = <span className="whitespace-nowrap" />;

  function getBackButtonRouteId() {
    if (ageCategory === 'youth') {
      return 'protected/application/$id/living-independently';
    }

    return context === 'intake' //
      ? 'protected/application/$id/personal-information'
      : 'protected/application/$id/renewal-selection';
  }

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await fetcher.submit(event.currentTarget, { method: 'POST' });
    removeApplicationFlowStorageValue();
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.parentOrGuardian.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-8 space-y-4">
          <p className="mb-4">{t(($) => $.parentOrGuardian.unableToApply)}</p>
          <p>
            <Trans ns="protectedApplicationSpokes" i18nKey={($) => $.parentOrGuardian.applyForYourself} components={{ noWrap }} />
          </p>
        </div>
        <fetcher.Form method="post" onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId={getBackButtonRouteId()}
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - Parent or guardian needs to apply click"
          >
            {t(($) => $.parentOrGuardian.backBtn)}
          </ButtonLink>
          <LoadingButton type="submit" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Exit - Parent or guardian needs to apply click">
            {t(($) => $.parentOrGuardian.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
