import { createCsrfMiddleware } from 'remix-utils/middleware/csrf';

import { createLogger } from '~/.server/logging/logger-factory';

const log = createLogger('middleware/csrf');

export const csrfMiddleware = createCsrfMiddleware({
  onUntrustedRequest: (error) => {
    log.warn('Untrusted request detected: %o', error);
    return new Response('Untrusted request', { status: 403 });
  },
});
