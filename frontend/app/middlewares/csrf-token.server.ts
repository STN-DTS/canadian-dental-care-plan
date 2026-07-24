import { createCookie } from 'react-router';

import { createCsrfTokenMiddleware } from 'remix-utils/middleware/csrf-token';

import { createLogger } from '~/.server/logging/logger-factory';

const log = createLogger('middleware/csrf-token');

const csrfCookie = createCookie('__CDCP||csrf', {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
});

export const [csrfTokenMiddleware, getCsrfToken] = createCsrfTokenMiddleware({
  cookie: csrfCookie,
  onInvalidToken(error) {
    log.warn('Invalid CSRF token: %o', error);
    return new Response('Invalid CSRF token', { status: 403 });
  },
});
