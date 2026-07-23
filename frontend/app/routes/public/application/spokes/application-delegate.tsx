import { redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/application-delegate';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearPublicApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT } from '~/.server/utils/locale-utils';
import { AppPageTitle } from '~/components/app-page-title';
import { ButtonLink } from '~/components/buttons';
import { CsrfTokenInput } from '~/components/csrf-token-input';
import { InlineLink } from '~/components/inline-link';
import { LoadingButton } from '~/components/loading-button';
import { useApplicationFlowStorage, useFetcherSubmissionState } from '~/hooks';
import { pageIds } from '~/page-ids';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';

export const handle = {
  pageIdentifier: pageIds.public.application.spokes.applicationDelegate,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.applicationDelegate.pageTitle) }),
  };

  return { meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'applicationSpokes');

  clearPublicApplicationState({ params, session });

  return redirect(t(($) => $.applicationDelegate.exitBtnLink));
}

export default function ApplicationDelegate({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('applicationSpokes');
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const contactServiceCanada = <InlineLink to={t(($) => $.applicationDelegate.contactServiceCanadaHref)} className="external-link" newTabIndicator target="_blank" />;
  const preparingToApply = <InlineLink to={t(($) => $.applicationDelegate.preparingToApplyHref)} className="external-link" newTabIndicator target="_blank" />;
  const noWrap = <span className="whitespace-nowrap" />;

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await fetcher.submit(event.currentTarget, { method: 'POST' });
    removeApplicationFlowStorageValue();
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.applicationDelegate.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-8 space-y-4">
          <p>
            <Trans ns="applicationSpokes" i18nKey={($) => $.applicationDelegate.contactRepresentative} components={{ contactServiceCanada, noWrap }} />
          </p>
          <p>
            <Trans ns="applicationSpokes" i18nKey={($) => $.applicationDelegate.prepareToApply} components={{ preparingToApply }} />
          </p>
        </div>
        <fetcher.Form method="post" onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            variant="secondary"
            type="button"
            routeId="public/application/$id/type-application"
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Applying on behalf of someone click"
          >
            {t(($) => $.applicationDelegate.backBtn)}
          </ButtonLink>
          <LoadingButton type="submit" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Exit - Applying on behalf of someone click">
            {t(($) => $.applicationDelegate.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
