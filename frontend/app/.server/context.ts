import { createContext } from 'react-router';

import type { AppContainerProvider } from '~/.server/app-container.provider';
import type { Session } from '~/.server/web/session';

export type AppContext = {
  readonly appContainer: AppContainerProvider;
  readonly session: Session;
};

/**
 * The appContext is a React Router context that holds the AppContext data.
 * It is created using the createContext function from react-router.
 */
export const appContext = createContext<AppContext>();
