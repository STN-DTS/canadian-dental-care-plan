import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import { throwAppError } from '~/.server/utils/error-utils';
import { ErrorCodes } from '~/errors/error-codes';
import { getContext } from '~/middlewares/context-storage.server';

export type UserContext = {
  birthdate?: string;
  id: string;
  locale?: string;
  mocked: boolean;
  sin: string;
};

/**
 * React Router context populated with authenticated user details by `authMiddleware`.
 */
export const userContext = createContext<UserContext | null>(null);

/**
 * Gets authenticated user details from provided router context or current request context.
 *
 * @param context - Optional router context provider. Defaults to current request context.
 * @returns Authenticated user details populated by `authMiddleware`.
 * @throws {AppError} When `authMiddleware` has not populated user context.
 */
export function getUser(context?: Readonly<RouterContextProvider>): UserContext {
  const ctx = context ?? getContext();
  const user = ctx.get(userContext);

  if (!user) {
    throwAppError('User context is not available. Ensure that the user has been set in the context.', ErrorCodes.PLT_CTX_USER_UNAVAILABLE);
  }

  return user;
}
