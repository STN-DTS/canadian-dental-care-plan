/**
 * Configures token-based CSRF protection using `remix-utils`.
 *
 * The middleware stores the token in a cookie and validates the matching token
 * submitted in form data. Cookie and token signing secrets are configured
 * independently through server environment variables.
 *
 * The CSRF middleware requires `@oslojs/crypto`, `@oslojs/encoding`, and React
 * Router at runtime. Keep these packages in the application dependencies even
 * though the Oslo packages are used indirectly through `remix-utils`.
 *
 * The middleware is registered by the public and protected layouts, so it
 * validates actions in those route trees only. Actions outside those trees are
 * not validated by this middleware.
 *
 * @see https://sergiodxa.github.io/remix-utils/modules/Middleware_CSRF-Token.html
 */
import { createCookie } from 'react-router';

import { createCsrfTokenMiddleware } from 'remix-utils/middleware/csrf-token';

import { createLogger } from '~/.server/logging/logger-factory';
import { getEnv } from '~/.server/utils/env-utils';
import { CSRF_FORM_DATA_KEY } from '~/constants/csrf-token';

const log = createLogger('middleware/csrf-token');

const { CSRF_TOKEN_COOKIE_NAME, CSRF_TOKEN_COOKIE_SECRET, CSRF_TOKEN_SECRET } = getEnv();

const csrfCookie = createCookie(CSRF_TOKEN_COOKIE_NAME, {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  secrets: CSRF_TOKEN_COOKIE_SECRET ? [CSRF_TOKEN_COOKIE_SECRET] : undefined,
  sameSite: 'lax',
});

const [csrfTokenMiddleware, getCsrfToken] = createCsrfTokenMiddleware({
  cookie: csrfCookie,
  formDataKey: CSRF_FORM_DATA_KEY,
  secret: CSRF_TOKEN_SECRET,
  onInvalidToken(error) {
    log.warn('Invalid CSRF token: %o', error);
    return new Response('Invalid CSRF token', { status: 403 });
  },
});

export { csrfTokenMiddleware, getCsrfToken };
