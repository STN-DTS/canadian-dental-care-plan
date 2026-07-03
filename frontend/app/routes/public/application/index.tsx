import { useEffect } from 'react';

import { useNavigate, useNavigation } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/index';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { startApplicationState } from '~/.server/routes/helpers/public-application-route-helpers';
import { getFixedT, getLocale } from '~/.server/utils/locale.utils';
import { AppPageTitle } from '~/components/app-page-title';
import { useApplicationFlowStorage } from '~/hooks';
import { pageIds } from '~/page-ids';
import { getCurrentDateString } from '~/utils/date-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';
import { getPathById } from '~/utils/route-utils';
import { getTitleMetaTags } from '~/utils/seo-utils';
import { secondsToMilliseconds } from '~/utils/units.utils';

export const handle = {
  pageIdentifier: pageIds.public.application.index,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => getTitleMetaTags(loaderData.meta.title));

export async function loader({ context, request }: Route.LoaderArgs) {
  const { appContainer, session } = context.get(appContext);
  const t = await getFixedT(request, ['application', 'gcweb']);
  const locale = getLocale(request);

  const currentDate = getCurrentDateString(locale);
  const applicationYearService = appContainer.get(TYPES.ApplicationYearService);
  const applicationYear = applicationYearService.getIntakeApplicationYear(currentDate);
  const state = startApplicationState({ session, applicationYear });

  const meta = { title: t(($) => $.meta.title.template, { ns: 'gcweb', title: t(($) => $.index.pageTitle) }) };

  return { id: state.id, locale, meta };
}

// Set a delay to ensure the loading state is visible before navigating to the next page.
const NAVIGATION_DELAY_MS = secondsToMilliseconds(1);

export default function PublicApplicationIndex({ loaderData, params }: Route.ComponentProps) {
  const { id } = loaderData;

  const { t } = useTranslation('application');
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { set: setApplicationFlowStorageValue } = useApplicationFlowStorage(id);

  const isIdle = navigation.state === 'idle';
  const eligibilityRequirementsPath = getPathById('public/application/$id/eligibility-requirements', { ...params, id });

  useEffect(() => {
    setApplicationFlowStorageValue('active');

    // Only navigate if the app is idle and no navigation timeout is already set (to prevent multiple timeouts from
    // being set if the effect runs multiple times).
    let navigateTimeout: NodeJS.Timeout | undefined;

    if (isIdle && !navigateTimeout) {
      navigateTimeout = setTimeout(() => {
        // Use replace to avoid adding an extra entry in the history stack, preventing
        // the user from going back to the loading page.
        void navigate(eligibilityRequirementsPath, { replace: true });
      }, NAVIGATION_DELAY_MS);
    }

    return () => {
      if (navigateTimeout) {
        clearTimeout(navigateTimeout);
      }
    };
  }, [setApplicationFlowStorageValue, eligibilityRequirementsPath, isIdle, navigate]);

  return (
    <>
      <AppPageTitle>{t(($) => $.eligibilityRequirements.pageHeading)}</AppPageTitle>
      <div className="max-w-prose animate-pulse space-y-8">
        {/* Intro text */}
        <div className="space-y-4">
          <div className="h-5 w-40 rounded bg-gray-200"></div>
          <div className="h-5 w-56 rounded bg-gray-200"></div>
        </div>

        {/* Card 1 */}
        <div className="rounded-lg border border-gray-300">
          <div className="space-y-8 p-6">
            <div className="h-6 w-3/4 rounded bg-gray-300"></div>
            <div className="space-y-3">
              <div className="h-5 w-full rounded bg-gray-200"></div>
              <div className="h-5 w-5/6 rounded bg-gray-200"></div>
            </div>
          </div>

          <div className="border-t border-gray-300 bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-gray-300"></div>
              <div className="h-5 w-2/3 rounded bg-gray-200"></div>
            </div>
          </div>
        </div>

        {/* Card 2 */}
        <div className="rounded-lg border border-gray-300">
          <div className="space-y-8 p-6">
            <div className="h-6 w-40 rounded bg-gray-300"></div>
            <div className="space-y-3">
              <div className="h-5 w-full rounded bg-gray-200"></div>
              <div className="h-5 w-5/6 rounded bg-gray-200"></div>
            </div>
          </div>

          <div className="border-t border-gray-300 bg-gray-50 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-6 w-6 rounded-full bg-gray-300"></div>
              <div className="h-5 w-32 rounded bg-gray-200"></div>
            </div>
          </div>
        </div>

        {/* Next button */}
        <div className="flex w-64 items-center justify-between rounded bg-gray-300 px-6 py-4">
          <div className="space-y-3">
            <div className="h-4 w-10 rounded bg-gray-200"></div>
            <div className="h-5 w-32 rounded bg-gray-200"></div>
          </div>
          <div className="h-8 w-8 rounded-full bg-gray-200"></div>
        </div>
      </div>
    </>
  );
}
