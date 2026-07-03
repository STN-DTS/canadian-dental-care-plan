import { redirect, useFetcher } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/child-parent-guardian';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearPublicApplicationState, getPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { LoadingButton } from '~/components/loading-button';
import { useApplicationFlowStorage, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.childParentOrGuardian,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  getPublicApplicationState({ params, session });
  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.children.parentOrGuardian.pageTitle) }),
  };

  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  getPublicApplicationState({ params, session });

  const t = await getFixedT(url, 'applicationSpokes');

  clearPublicApplicationState({ params, session });
  return redirect(t(($) => $.children.parentOrGuardian.exitBtnLink));
}

export default function ParentOrGuardian({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('applicationSpokes');
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await fetcher.submit(event.currentTarget, { method: 'POST' });
    removeApplicationFlowStorageValue();
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.children.parentOrGuardian.pageTitle)}</AppPageTitle>
      <div className="mb-8 space-y-4">
        <p>{t(($) => $.children.parentOrGuardian.unableToApply)}</p>
      </div>
      <fetcher.Form method="post" onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-3">
        <CsrfTokenInput />
        <ButtonLink
          id="back-button"
          variant="secondary"
          routeId="public/application/$id/children/$childId/information"
          params={params}
          disabled={isSubmitting}
          data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Child parent or guardian needs to apply click"
        >
          {t(($) => $.children.parentOrGuardian.backBtn)}
        </ButtonLink>
        <LoadingButton type="submit" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Exit - Child parent or guardian needs to apply click">
          {t(($) => $.children.parentOrGuardian.exitBtn)}
        </LoadingButton>
      </fetcher.Form>
    </>
  );
}
