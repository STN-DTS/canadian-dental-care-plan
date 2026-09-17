import type { MiddlewareFunction } from 'react-router';

import { TYPES } from '~/.server/constants/';
import { appContext } from '~/.server/context';
import { clientApplicationContext } from '~/.server/context/client-application-context';

/**
 * Resolves the client application for the current route and adds it to React Router context.
 * Requests that cannot resolve an application are handled by `SecurityHandler.requireClientApplication`.
 */
export const clientApplicationMiddleware: MiddlewareFunction<Response> = async ({ context, params, url }, next) => {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  const clientApplication = await securityHandler.requireClientApplication({ params, requestUrl: url, session });
  context.set(clientApplicationContext, clientApplication);
  return await next();
};
