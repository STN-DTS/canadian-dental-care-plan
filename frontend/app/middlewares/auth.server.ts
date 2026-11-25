import type { MiddlewareFunction } from 'react-router';

import { invariant } from '@dts-stn/invariant';
import { Option } from 'effect';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context/app-context';
import { createUserContext, userContext } from '~/.server/context/user-context';

/**
 * Validates the RAOIDC session and adds authenticated user details to request context.
 * Invalid sessions are redirected by `SecurityHandler.validateAuthSession` before protected
 * route middleware, loaders, or actions run.
 */
export const authMiddleware: MiddlewareFunction<Response> = async ({ context, url }, next) => {
  const { appContainer, session } = context.get(appContext);
  const securityHandler = appContainer.get(TYPES.SecurityHandler);
  await securityHandler.validateAuthSession({ requestUrl: url, session });

  const idToken = session.get('idToken');
  const userInfoToken = session.get('userInfoToken');
  invariant(idToken.sub === userInfoToken.sub, 'Expected idToken.sub to match userInfoToken.sub');
  invariant(userInfoToken.sin, 'Expected userInfoToken.sin to be defined');

  context.set(userContext, Option.getOrThrow(createUserContext(idToken, userInfoToken)));

  return await next();
};
