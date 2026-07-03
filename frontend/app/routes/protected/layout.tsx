import { Outlet, isRouteErrorResponse, useNavigate, useRouteError } from 'react-router';

import { useTranslation } from 'react-i18next';

import type { Route } from './+types/layout';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { NotFoundError, ProtectedLayout, ServerError, protectedLayoutI18nNamespace } from '~/components/layouts/protected-layout';
import SessionTimeout from '~/components/session-timeout';
import { useApiSession } from '~/utils/api-session-utils';
import { mergeMeta } from '~/utils/meta-utils';
import type { RouteHandleData } from '~/utils/route-utils';

export const handle = {
  i18nPreloadNamespace: protectedLayoutI18nNamespace,
} as const satisfies RouteHandleData;

export const meta: Route.MetaFunction = mergeMeta(({ loaderData }) => {
  return [{ name: 'dcterms.accessRights', content: '1' }];
});

export function loader({ context, url }: Route.LoaderArgs) {
  const { appContainer } = context.get(appContext);
  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = appContainer.get(TYPES.ClientConfig);
  return { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS };
}

export function ErrorBoundary() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundError error={error} />;
  }

  return <ServerError error={error} />;
}

export default function Layout({ loaderData, params }: Route.ComponentProps) {
  const { SESSION_TIMEOUT_PROMPT_SECONDS, SESSION_TIMEOUT_SECONDS } = loaderData;
  const navigate = useNavigate();
  const apiSession = useApiSession();
  const { i18n } = useTranslation();

  async function handleOnSessionEnd() {
    await navigate('/auth/logout?locale=' + i18n.language);
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
