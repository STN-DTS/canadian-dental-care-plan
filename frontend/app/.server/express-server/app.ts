/**
 * React Router Express server
 */
import { createRequestHandler } from '@react-router/express';
import { RouterContextProvider } from 'react-router';
import type { ServerBuild } from 'react-router';

import express from 'express';

import { appContext } from '~/.server/context';
import { getAppContext } from '~/.server/express-server/app-context';
import { createLogger } from '~/.server/logging';
import { getEnv } from '~/.server/utils/env-utils';
import { hasSingleton, setSingleton, singleton } from '~/.server/utils/instance-registry';
import { createAgnosticRoutes, createServerRoutes } from '~/.server/utils/server-build-utils';

const log = createLogger('app');

export const app: express.Express = express();

app.use(
  createRequestHandler({
    build: async (): Promise<ServerBuild> => {
      // eslint-disable-next-line import-x/no-unresolved
      const serverBuild = (await import('virtual:react-router/server-build')) as ServerBuild;
      const registeredBuild = hasSingleton('serverBuild') ? singleton('serverBuild') : undefined;

      // Reuse the registered build when it has not changed. This avoids rebuilding
      // the derived route tree for every request.
      if (registeredBuild === serverBuild) {
        log.debug('Server build already registered, returning existing build');
        return serverBuild;
      }

      log.info('Registering server build and creating agnostic routes');

      // Register the build before deriving the route tree used by request
      // instrumentation to resolve paths with `matchRoutes`.
      setSingleton('serverBuild', serverBuild);

      // Convert the flat server route manifest into a hierarchical matcher tree.
      const serverRoutes = createServerRoutes(serverBuild.routes);

      // Create a route tree that is agnostic to the server build, so that it can be
      // used by request instrumentation to resolve paths with `matchRoutes`. The
      // agnostic route tree is registered as a singleton so that it can be reused
      // across requests.
      setSingleton('agnosticRoutes', createAgnosticRoutes(serverRoutes));

      return serverBuild;
    },
    mode: getEnv().NODE_ENV,
    getLoadContext: (req) => {
      const contextProvider = new RouterContextProvider();
      contextProvider.set(appContext, getAppContext(req));
      return contextProvider;
    },
  }),
);
