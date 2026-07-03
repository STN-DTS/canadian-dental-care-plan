import { Outlet } from 'react-router';

import type { Route } from './+types/layout';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { getLocale } from '~/.server/utils/locale.utils';
import { PublicLayout, publicLayoutI18nNamespace } from '~/components/layouts/public-layout';
import SessionTimeout from '~/components/session-timeout';
import { useApiSession } from '~/utils/api-session-utils';
import type { RouteHandleData } from '~/utils/route-utils';

export const handle = {
  // Declare all i18n namespaces required by this route and its descendants.
  // Preloading them upfront ensures translations are available on initial render.
  i18nPreloadNamespace: [publicLayoutI18nNamespace, 'status'],
} as const satisfies RouteHandleData;

export function loader({ context, request }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const locale = getLocale(request);
  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = appContainer.get(TYPES.ClientConfig);
  return { locale, SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS };
}

export default function Route({ loaderData, params }: Route.ComponentProps) {
  const { locale, SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = loaderData;
  const apiSession = useApiSession();

  async function handleOnSessionEnd() {
    await apiSession.submit({ action: 'end', locale, redirectTo: 'cdcp-website-status' });
  }

  async function handleOnSessionExtend() {
    await apiSession.submit({ action: 'extend' });
  }

  return (
    <PublicLayout>
      <SessionTimeout promptBeforeIdle={SESSION_TIMEOUT_PROMPT_SECONDS * 1000} timeout={SESSION_TIMEOUT_SECONDS * 1000} onSessionEnd={handleOnSessionEnd} onSessionExtend={handleOnSessionExtend} />
      <Outlet />
    </PublicLayout>
  );
}
