import { createContext } from 'react-router';
import type { RouterContextProvider } from 'react-router';

import type { ClientApplicationDto } from '~/.server/domain/dtos';
import { throwAppError } from '~/.server/utils/error-utils';
import { ErrorCodes } from '~/errors/error-codes';

type ClientApplicationContext = ClientApplicationDto;

/**
 * React Router context containing the current client application.
 */
export const clientApplicationContext = createContext<ClientApplicationContext | null>(null);

/**
 * Retrieves the current client application from React Router context.
 *
 * @param context React Router context provider containing the client application.
 * @returns Current {@link ClientApplicationContext}.
 * @throws If the client application has not been set in the context.
 */
export function getClientApplication(context: Readonly<RouterContextProvider>): ClientApplicationContext {
  const clientApplication = context.get(clientApplicationContext);

  if (!clientApplication) {
    throwAppError('Client application context is not available. Ensure that the client application has been set in the context.', ErrorCodes.PLT_CTX_CLIENT_APPLICATION_UNAVAILABLE);
  }

  return clientApplication;
}
