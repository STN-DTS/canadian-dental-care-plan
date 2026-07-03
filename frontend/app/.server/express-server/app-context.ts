import type { AppLoadContext } from 'react-router';

import { UTCDate } from '@date-fns/utc';
import type express from 'express';
import type { SetOptional } from 'type-fest';

import { getAppContainerProvider } from '~/.server/app.container';
import { createLogger } from '~/.server/logging';
import { ExpressSession, NoopSession } from '~/.server/web/session';
import { randomString } from '~/utils/string-utils';

const log = createLogger('app-context.ts');

type Request = express.Request;
type RequestWithOptionalSession = SetOptional<Pick<express.Request, 'session'>, 'session'>;

/**
 * Creates an application context for the current request, which includes the app container and session management.
 *
 * @param req - The Express request object.
 * @returns An AppContext instance containing the application context.
 */
export function getAppContext(req: RequestWithOptionalSession): AppLoadContext {
  const appContainer = getAppContainerProvider();

  // `request.session` may be undefined if session middleware is not applied,
  // so a fallback `NoopSession` is used in that case.
  const session = req.session ? new ExpressSession(req as Request) : new NoopSession();

  if (session instanceof ExpressSession) {
    // We use session-scoped CSRF tokens to ensure back button and multi-tab navigation still works.
    // @see: https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html#synchronizer-token-pattern
    if (!session.has('csrfToken')) {
      const csrfToken = randomString(32);
      log.debug('Adding CSRF token [%s] to session', csrfToken);
      session.set('csrfToken', csrfToken);
    }

    const lastAccessTime = new UTCDate().toISOString();
    log.debug('Setting session.lastAccessTime to [%s]', lastAccessTime);
    session.set('lastAccessTime', lastAccessTime);
  }

  return { appContainer, session };
}
