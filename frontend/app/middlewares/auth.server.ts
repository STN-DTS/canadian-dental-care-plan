import type { MiddlewareFunction } from 'react-router';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';

/**
 * Requires valid RAOIDC session before protected route middleware, loaders, or actions run.
 * Invalid sessions are redirected by `SecurityHandler.validateAuthSession`.
 */
export const authMiddleware: MiddlewareFunction<Response> = async ({ context, url }, next) => {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });
  return await next();
};
