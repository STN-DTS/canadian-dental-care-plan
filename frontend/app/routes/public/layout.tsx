import { Outlet, data, isRouteErrorResponse, useParams, useRouteError } from 'react-router';

import { AuthenticityTokenProvider } from 'remix-utils/csrf/react';

import type { Route } from './+types/layout';

import { createLogger } from '~/.server/logging';
import { BilingualNotFoundError, NotFoundError, ServerError } from '~/components/layouts/public-layout';
import { csrfTokenMiddleware, getCsrfToken } from '~/middlewares/csrf-token.server';
import { csrfMiddleware } from '~/middlewares/csrf.server';
import { isAppLocale } from '~/utils/locale-utils';

export const middleware: Route.MiddlewareFunction[] = [csrfMiddleware, csrfTokenMiddleware];

export function loader({ context, params }: Route.LoaderArgs) {
  const log = createLogger('public/layout/loader');

  if (!isAppLocale(params.lang)) {
    log.warn('Invalid lang requested [%s]; responding with 404', params.lang);
    throw data(null, { status: 404 });
  }

  return {
    csrfToken: getCsrfToken(context),
  };
}

export function ErrorBoundary() {
  const error = useRouteError();
  const params = useParams();
  const lang = params.lang;

  if (isRouteErrorResponse(error) && error.status === 404) {
    return isAppLocale(lang) ? <NotFoundError error={error} /> : <BilingualNotFoundError error={error} />;
  }

  // TODO :: GjB :: create bilingual 500 page
  return isAppLocale(lang) ? <ServerError error={error} /> : <ServerError error={error} />;
}

export default function Route({ loaderData }: Route.ComponentProps) {
  const { csrfToken } = loaderData;

  return (
    <AuthenticityTokenProvider token={csrfToken}>
      <Outlet />
    </AuthenticityTokenProvider>
  );
}
