import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import type { AppContainerProvider } from '~/.server/app-container-provider';
import type { Session } from '~/.server/web/session';
import { getContext } from '~/middlewares/context-storage.server';

export type AppContext = {
  readonly appContainer: AppContainerProvider;
  readonly session: Session;
};

/**
 * React Router context containing application services and session for current request.
 */
export const appContext = createContext<AppContext>();

/**
 * Gets application context from provided router context or current request context.
 *
 * @param context - Optional router context provider. Defaults to current request context.
 * @returns Application services and session associated with selected context.
 */
export function getAppContext(context?: Readonly<RouterContextProvider>): AppContext {
  const ctx = context ?? getContext();
  return ctx.get(appContext);
}
