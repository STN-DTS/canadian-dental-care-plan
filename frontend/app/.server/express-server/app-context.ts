import { UTCDate } from '@date-fns/utc';
import type express from 'express';

import { appContainer } from '~/.server/app-container';
import type { AppContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { ExpressSession, NoopSession } from '~/.server/web/session';

const log = createLogger('app-context');

/**
 * Creates an application context for the current request, which includes the app container and session management.
 *
 * @param req - The Express request object.
 * @returns An AppContext instance containing the application context.
 */
export function getAppContext(req: express.Request): AppContext {
  // `request.session` may be undefined if session middleware is not applied,
  // so a fallback `NoopSession` is used in that case.
  // oxlint-disable-next-line typescript/no-unnecessary-condition
  const session = req.session !== undefined ? new ExpressSession(req) : new NoopSession();

  if (session instanceof ExpressSession) {
    const lastAccessTime = new UTCDate().toISOString();
    log.debug('Setting session.lastAccessTime to [%s]', lastAccessTime);
    session.set('lastAccessTime', lastAccessTime);
  }

  return {
    appContainer: appContainer(),
    session,
  };
}
