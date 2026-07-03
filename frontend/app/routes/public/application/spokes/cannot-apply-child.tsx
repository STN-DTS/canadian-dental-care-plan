import { redirect, useFetcher } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { Trans, useTranslation } from 'react-i18next';

import type { Route } from './+types/cannot-apply-child';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getAgeCategoryFromDateString } from '~/.server/routes/helpers/base-application-route-helpers';
import { clearPublicApplicationState, getSingleChildState } from '~/.server/routes/helpers/public-application-route-helpers';
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
  pageIdentifier: pageIds.public.application.spokes.cannotApplyChild,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { session } = context.get(appContext);
  const childState = getSingleChildState({ params, session });
  const t = await getFixedT(url, ['applicationSpokes', 'gcweb']);

  const meta = {
    title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.children.cannotApplyChild.pageTitle) }),
  };

  invariant(childState.information?.dateOfBirth, 'Child date of birth must be defined');
  const ageCategory = getAgeCategoryFromDateString(childState.information.dateOfBirth);

  // Determines which message to display:
  // - If the applicant is currently a child or youth, show content indicating they will turn 18 by the end of the current coverage.
  // - Otherwise, show content indicating they are not eligible to apply because they are an adult.
  const isChildrenOrYouth = ageCategory === 'children' || ageCategory === 'youth';

  return { isChildrenOrYouth, meta };
}

export async function action({ context, params, request, url }: Route.ActionArgs) {
  const { appContainer, session } = context.get(appContext);
  const formData = await request.formData();

  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  securityHandler.validateCsrfToken({ formData, session });

  const t = await getFixedT(url, 'applicationSpokes');

  clearPublicApplicationState({ params, session });

  return redirect(t(($) => $.children.cannotApplyChild.exitBtnLink));
}

export default function ApplyForYourself({ loaderData, params }: Route.ComponentProps) {
  const { isChildrenOrYouth } = loaderData;
  const { t } = useTranslation('applicationSpokes');

  const fetcher = useFetcher<typeof action>();
  const { isSubmitting } = useFetcherSubmissionState(fetcher);

  const noWrap = <span className="whitespace-nowrap" />;

  return (
    <>
      <AppPageTitle>{t(($) => $.children.cannotApplyChild.pageTitle)}</AppPageTitle>
      <div className="max-w-prose">
        <div className="mb-6 space-y-4">
          <p>
            {isChildrenOrYouth //
              ? t(($) => $.children.cannotApplyChild.ineligibleToApply.cutoffApplication)
              : t(($) => $.children.cannotApplyChild.ineligibleToApply.adultApplication)}
          </p>
          <p>
            <Trans ns="applicationSpokes" i18nKey={($) => $.children.cannotApplyChild.eligibilityInfo} components={{ noWrap }} />
          </p>
        </div>
        <fetcher.Form method="post" noValidate className="flex flex-wrap items-center gap-3">
          <CsrfTokenInput />
          <ButtonLink
            id="back-button"
            variant="secondary"
            routeId="public/application/$id/children/$childId/information"
            params={params}
            disabled={isSubmitting}
            data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Back - Child apply for yourself click"
          >
            {t(($) => $.children.cannotApplyChild.backBtn)}
          </ButtonLink>
          <LoadingButton type="submit" variant="primary" id="proceed-button" loading={isSubmitting} data-gc-analytics-customclick="ESDC-EDSC:CDCP Online Application Form-Spoke:Exit - Child apply for yourself click">
            {t(($) => $.children.cannotApplyChild.exitBtn)}
          </LoadingButton>
        </fetcher.Form>
      </div>
    </>
  );
}
