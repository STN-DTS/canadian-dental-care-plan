/**
 * Configures origin-based CSRF protection using `remix-utils`.
 *
 * Requests from untrusted origins are logged and rejected with a 403 response.
 * The middleware is registered by the public and protected layouts.
 *
 * @see https://github.com/sergiodxa/remix-utils/tree/main/src/server/middleware
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
