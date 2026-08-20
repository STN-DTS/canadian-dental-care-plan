import { Outlet, data, isRouteErrorResponse, useParams, useRouteError } from 'react-router';

import { AuthenticityTokenProvider } from 'remix-utils/csrf/react';

import type { Route } from './+types/localized-layout';

import { createLogger } from '~/.server/logging';
import { BilingualNotFoundError, NotFoundError, ServerError } from '~/components/layouts/public-layout';
import { csrfTokenMiddleware, getCsrfToken } from '~/middlewares/csrf-token.server';
import { csrfMiddleware } from '~/middlewares/csrf.server';
import { isAppLocale } from '~/utils/locale-utils';

const log = createLogger('localized-layout');

/**
 * Validates the locale route parameter before localized middleware and routes run.
 * Invalid or missing locales receive a bilingual 404 response.
 */
const appLocaleMiddleware: Route.MiddlewareFunction = async ({ params }, next) => {
  if (!isAppLocale(params.lang)) {
    log.warn('Invalid lang requested [%s]; responding with 404', params.lang);
    throw data(null, { status: 404 });
  }
  return await next();
};

export const middleware: Route.MiddlewareFunction[] = [appLocaleMiddleware, csrfMiddleware, csrfTokenMiddleware];

export function loader({ context }: Route.LoaderArgs) {
  return {
    csrfToken: getCsrfToken(context),
  };
}

export default function LocalizedLayout({ loaderData }: Route.ComponentProps) {
  const { csrfToken } = loaderData;

  return (
    <AuthenticityTokenProvider token={csrfToken}>
      <Outlet />
    </AuthenticityTokenProvider>
  );
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
