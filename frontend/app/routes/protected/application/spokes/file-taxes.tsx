import { redirect, useFetcher } from 'react-router';

import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/file-taxes';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { clearProtectedApplicationState, getProtectedApplicationState } from '~/.server/routes/helpers/protected-application-route-helpers';
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
  pageIdentifier: pageIds.protected.application.spokes.fileYourTaxes,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const { applicationYear } = getProtectedApplicationState({ params, session });

  const t = await getFixedT(url, ['protectedApplication', 'gcweb']);
  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.fileYourTaxes.pageTitle) }),
  };

  return { meta, taxYear: applicationYear.taxYear };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'protectedApplication');

  clearProtectedApplicationState({ params, session });
  return redirect(t(($) => $.fileYourTaxes.exitBtnLink));
}

export default function ApplicationFileYourTaxes({ loaderData, params }: Route.ComponentProps) {
  const { t } = useTranslation('protectedApplication');
  const { taxYear } = loaderData;
  const { remove: removeApplicationFlowStorageValue } = useApplicationFlowStorage(params.id);

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const taxInfo = <InlineLink to={t(($) => $.fileYourTaxes.taxInfoHref)} className="external-link" newTabIndicator target="_blank" />;

  async function handleSubmit(event: React.SyntheticEvent<HTMLFormElement, SubmitEvent>) {
    event.preventDefault();
    await fetcher.submit(event.currentTarget, { method: 'POST' });
    removeApplicationFlowStorageValue();
  }

  return (
    <>
      <AppPageTitle>{t(($) => $.fileYourTaxes.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-8 space-y-4">
          <p>{t(($) => $.fileYourTaxes.ineligibleToApply)}</p>
          <p>{t(($) => $.fileYourTaxes.taxNotFiled, { taxYear: taxYear })}</p>
          <p>{t(($) => $.fileYourTaxes.unableToAssess)}</p>
          <p>
            <Trans ns="protectedApplication" i18nKey={($) => $.fileYourTaxes.taxInfo} components={{ taxInfo }} />
          </p>
          <p>
            <Trans ns="protectedApplication" i18nKey={($) => $.fileYourTaxes.applyAfter} />
          </p>
        </div>
        <fetcher.Form method="post" onSubmit={handleSubmit} noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId="protected/application/$id/tax-filing"
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Back - File your taxes click"
          >
            {t(($) => $.fileYourTaxes.backBtn)}
          </ButtonLink>
          <LoadingButton type="submit" variant="primary" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Protected-Spoke:Exit - File your taxes click">
            {t(($) => $.fileYourTaxes.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
