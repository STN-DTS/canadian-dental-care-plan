import type { MiddlewareFunction } from 'react-router';

import { TYPES } from '~/.server/constants/';
import { appContext } from '~/.server/context';
import type { FeatureName } from '~/utils/env-utils';

/**
 * Creates middleware that validates whether a feature is enabled before continuing.
 * Disabled features are rejected by `SecurityHandler.validateFeatureEnabled`.
 *
 * @param feature Feature to validate for the current route.
 * @returns Middleware that validates the feature and then calls the next handler.
 */
export function createFeatureMiddleware(feature: FeatureName): MiddlewareFunction<Response> {
  return async function featureMiddleware({ context }, next) {
    const { appContainer } = context.get(appContext);
    const securityHandler = appContainer.get(TYPES.SecurityHandler);
    securityHandler.validateFeatureEnabled(feature);
    return await next();
  };
}
