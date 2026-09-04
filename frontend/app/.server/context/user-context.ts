import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import { AppError } from '~/errors/app-error';

export type UserContext = {
  birthdate?: string;
  id: string;
  locale?: string;
  mocked: boolean;
  sin: string;
};

/**
 * React Router context containing authenticated user details populated by `authMiddleware`.
 */
export const userContext = createContext<UserContext | null>(null);

/**
 * Retrieves authenticated user details from React Router context.
 *
 * @param context React Router context provider populated by `authMiddleware`.
 * @returns Authenticated {@link UserContext}.
 * @throws If `authMiddleware` has not populated the context.
 */
export function getUser(context: Readonly<RouterContextProvider>): UserContext {
  const user = context.get(userContext);

  if (!user) {
    throw new AppError('User context is not available. Ensure that the user has been set in the context.');
  }

  return user;
}
