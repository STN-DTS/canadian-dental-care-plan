import type express from 'express';

import { appContainer } from '~/.server/app-container';
import type { AppContext } from '~/.server/context/app-context';
import { ExpressSession, NoopSession } from '~/.server/web/session';

/**
 * Creates an application context for the current request, which includes the app container and session management.
 *
 * @param req - The Express request object.
 * @returns An AppContext instance containing the application context.
 */
export function getAppContext(req: express.Request): AppContext {
  return {
    appContainer: appContainer(),
    // `request.session` may be undefined if session middleware is not applied,
    // so a fallback `NoopSession` is used in that case.
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    session: req.session !== undefined ? new ExpressSession(req) : new NoopSession(),
  };
}
