import { Outlet } from 'react-router';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import { KillswitchDialog } from '~/components/killswitch-dialog';
import { transformAdobeAnalyticsUrl } from '~/route-helpers/adobe-analytics-route-helpers';
import type { RouteHandleData } from '~/utils/route-utils';

import type { Route } from './+types/base-layout';

export const handle = {
  // Declare all i18n namespaces required by this route and its descendants.
  // Preloading them upfront ensures translations are available on initial render.
  i18nPreloadNamespace: [
    'gcweb',
    'common',
    'protectedApplication',
    'protectedApplicationIntakeAdult',
    'protectedApplicationIntakeChild',
    'protectedApplicationIntakeFamily',
    'protectedApplicationRenewalAdult',
    'protectedApplicationRenewalChild',
    'protectedApplicationRenewalFamily',
    'protectedApplicationSpokes',
  ],
  transformAdobeAnalyticsUrl,
} as const satisfies RouteHandleData;

export async function loader({ context }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);

  const redisService = appContainer.find(TYPES.RedisService);
  const killswitchTimeout = (await redisService?.ttl(KILLSWITCH_KEY)) ?? 0;

  return { killswitchTimeout };
}

export default function ProtectedApplicationBaseLayout({ loaderData }: Route.ComponentProps) {
  const { killswitchTimeout } = loaderData;

  return (
    <>
      <KillswitchDialog timeoutSecs={killswitchTimeout} />
      <Outlet />
    </>
  );
}
