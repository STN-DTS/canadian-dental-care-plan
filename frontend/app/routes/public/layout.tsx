import { Outlet, useMatches } from 'react-router';

import SessionTimeout from '~/components/session-timeout';
import { useClientEnv, useCurrentLanguage } from '~/hooks';
import type { ApiSessionRedirectTo } from '~/routes/api/session';
import { useApiSession } from '~/utils/api-session-utils';
import type { RouteHandleData } from '~/utils/route-utils';

export const handle = {
  i18nPreloadNamespace: 'gcweb',
} as const satisfies RouteHandleData;

/**
 * Public layout for routes that do not require an authenticated session.
 *
 * Hosts the single {@link SessionTimeout} for all public routes and chooses the
 * timeout redirect destination based on the active public route context.
 */
export default function Layout() {
  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = useClientEnv();
  const { currentLanguage } = useCurrentLanguage();
  const matches = useMatches();
  const apiSession = useApiSession();

  async function handleOnSessionEnd() {
    let redirectTo: ApiSessionRedirectTo = 'cdcp-website';

    if (matches.some((match) => match.id.startsWith('public/application/'))) {
      redirectTo = 'cdcp-website-apply';
    } else if (matches.some((match) => match.id.startsWith('public/status/'))) {
      redirectTo = 'cdcp-website-status';
    }

    await apiSession.submit({ action: 'end', locale: currentLanguage, redirectTo });
  }

  async function handleOnSessionExtend() {
    await apiSession.submit({ action: 'extend' });
  }

  return (
    <>
      <SessionTimeout promptBeforeIdle={SESSION_TIMEOUT_PROMPT_SECONDS * 1000} timeout={SESSION_TIMEOUT_SECONDS * 1000} onSessionEnd={handleOnSessionEnd} onSessionExtend={handleOnSessionExtend} />
      <Outlet />
    </>
  );
}
