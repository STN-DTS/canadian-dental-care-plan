/**
 * Configures origin-based CSRF protection using `remix-utils`.
 *
 * Requests from untrusted origins are logged and rejected with a 403 response.
 *
 * @see https://sergiodxa.github.io/remix-utils/modules/Middleware_CSRF.html
 */
import { createCsrfMiddleware } from 'remix-utils/middleware/csrf';

import { createLogger } from '~/.server/logging/logger-factory';

const log = createLogger('middleware/csrf');

export const csrfMiddleware = createCsrfMiddleware({
  onUntrustedRequest: (error) => {
    log.warn('Untrusted request detected: %o', error);
    return new Response('Untrusted request', { status: 403 });
  },
});
