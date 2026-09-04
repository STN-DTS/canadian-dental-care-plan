import type { MiddlewareFunction } from 'react-router';

import { invariant } from '@dts-stn/invariant';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { userContext } from '~/.server/context/user-context';

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

  context.set(userContext, {
    id: idToken.sub,
    sin: userInfoToken.sin,
    locale: userInfoToken.locale,
    mocked: userInfoToken.mocked === true,
    birthdate: userInfoToken.birthdate,
  });

  return await next();
};
