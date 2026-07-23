import { Outlet } from 'react-router';

import type { Route } from './+types/base-layout';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { KILLSWITCH_KEY } from '~/.server/domain/services';
import { getLocale } from '~/.server/utils/locale-utils';
import { KillswitchDialog } from '~/components/killswitch-dialog';
import { PublicLayout, publicLayoutI18nNamespace } from '~/components/layouts/public-layout';
import SessionTimeout from '~/components/session-timeout';
import { transformAdobeAnalyticsUrl } from '~/route-helpers/adobe-analytics-route-helpers';
import { useApiApplicationState } from '~/utils/api-application-state-utils';
import { useApiSession } from '~/utils/api-session-utils';
import type { RouteHandleData } from '~/utils/route-utils';

export const handle = {
  // Declare all i18n namespaces required by this route and its descendants.
  // Preloading them upfront ensures translations are available on initial render.
  i18nPreloadNamespace: [
    publicLayoutI18nNamespace, //
    'common',
    'application',
    'applicationFullAdult',
    'applicationFullChild',
    'applicationFullFamily',
    'applicationSimplifiedAdult',
    'applicationSimplifiedChild',
    'applicationSimplifiedFamily',
    'applicationSpokes',
  ],
  transformAdobeAnalyticsUrl,
} as const satisfies RouteHandleData;

export async function loader({ context, params, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const locale = getLocale(url);

  const redisService = appContainer.find(TYPES.RedisService);
  const killswitchTimeout = (await redisService?.ttl(KILLSWITCH_KEY)) ?? 0;

  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = appContainer.get(TYPES.ClientConfig);
  return { killswitchTimeout, locale, SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS };
}

export default function PublicApplicationBaseLayout({ loaderData, params }: Route.ComponentProps) {
  const { killswitchTimeout, locale, SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = loaderData;

  const apiApplicationState = useApiApplicationState();
  const apiSession = useApiSession();

  async function handleOnSessionEnd() {
    await apiSession.submit({ action: 'end', locale, redirectTo: 'cdcp-website-apply' });
  }

  async function handleOnSessionExtend() {
    // extends the application state if 'id' param exists
    const id = params.id;
    if (typeof id === 'string') {
      await apiApplicationState.submit({ action: 'extend', id });
      return;
    }

    // extends the user's session
    await apiSession.submit({ action: 'extend' });
  }

  return (
    <PublicLayout>
      <KillswitchDialog timeoutSecs={killswitchTimeout} />
      <SessionTimeout promptBeforeIdle={SESSION_TIMEOUT_PROMPT_SECONDS * 1000} timeout={SESSION_TIMEOUT_SECONDS * 1000} onSessionEnd={handleOnSessionEnd} onSessionExtend={handleOnSessionExtend} />
      <Outlet />
    </PublicLayout>
  );
}
