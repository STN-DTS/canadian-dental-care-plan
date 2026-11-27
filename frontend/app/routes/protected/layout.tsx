import { Outlet, isRouteErrorResponse, useNavigate } from 'react-router';

import { NotFoundError, ProtectedLayout, ServerError } from '~/components/layouts/protected-layout';
import SessionTimeout from '~/components/session-timeout';
import { useClientEnv, useCurrentLanguage } from '~/hooks';
import { authMiddleware } from '~/middlewares/auth.server';
import { useApiSession } from '~/utils/api-session-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';

import type { Route } from './+types/layout';

export const middleware: Route.MiddlewareFunction[] = [authMiddleware];

export const handle = {
  i18nPreloadNamespace: 'gcweb',
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return [{ name: 'dcterms.accessRights', content: '1' }];
});

export default function Layout() {
  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = useClientEnv();
  const { currentLanguage } = useCurrentLanguage();
  const navigate = useNavigate();
  const apiSession = useApiSession();

  async function handleOnSessionEnd() {
    await navigate('/auth/logout?locale=' + currentLanguage);
  }

  async function handleOnSessionExtend() {
    await apiSession.submit({ action: 'extend' });
  }

  return (
    <ProtectedLayout>
      <SessionTimeout promptBeforeIdle={SESSION_TIMEOUT_PROMPT_SECONDS * 1000} timeout={SESSION_TIMEOUT_SECONDS * 1000} onSessionEnd={handleOnSessionEnd} onSessionExtend={handleOnSessionExtend} />
      <Outlet />
    </ProtectedLayout>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundError error={error} />;
  }

  return <ServerError error={error} />;
}
