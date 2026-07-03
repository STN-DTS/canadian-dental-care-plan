/**
 * React Router Express server
 */
import { createRequestHandler } from '@react-router/express';
import { RouterContextProvider } from 'react-router';

import express from 'express';

import { appContext } from '~/.server/context';
import { getAppContext } from '~/.server/express-server/app-context';
import { getEnv } from '~/.server/utils/env.utils';
import { setSingleton } from '~/.server/utils/instance-registry';

export const app: express.Express = express();

app.use(
  createRequestHandler({
    // eslint-disable-next-line import/no-unresolved
    build: async () => setSingleton('serverBuild', await import('virtual:react-router/server-build')),
    mode: getEnv().NODE_ENV,
    getLoadContext: (req) => {
      const contextProvider = new RouterContextProvider();
      contextProvider.set(appContext, getAppContext(req));
      return contextProvider;
    },
  }),
);
