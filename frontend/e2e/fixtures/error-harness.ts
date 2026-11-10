import type { ServerBuild } from 'react-router';

import { readdir } from 'node:fs/promises';

if (process.env.CDCP_ERROR_TEST_HARNESS !== 'true' || process.env.NODE_ENV !== 'production') {
  throw new Error('The synthetic error harness requires an explicit local production test start');
}

const assetsUrl = new URL('../../build/server/assets/', import.meta.url);
const files = await readdir(assetsUrl);
const buildFile = files.find((file) => /^server-build-.*\.js$/.test(file));

if (!buildFile) {
  throw new Error('Build the frontend before running synthetic error tests');
}

const buildUrl = new URL(buildFile, assetsUrl).href;
const build = (await import(buildUrl)) as ServerBuild;
const { data } = await import('react-router');
const error = {
  name: 'AppError',
  correlationId: 'AB-123456',
  errorCode: 'TST-0000',
  httpStatusCode: 500,
  msg: 'Synthetic application failure',
  stack: new Error('Synthetic application failure').stack,
};

for (const route of Object.values(build.routes)) {
  if (!route) {
    continue;
  }

  const original = route.module;

  if (route.id === 'root') {
    route.module = {
      ...original,
      loader: async (args) => {
        if (args.url.pathname === '/') {
          throw error;
        }

        return await original.loader?.(args);
      },
    };
  } else if (route.id.startsWith('public/') || route.id.startsWith('protected/') || route.id.startsWith('routes/public/') || route.id.startsWith('routes/protected/')) {
    route.module = {
      ...original,
      middleware: [],
      loader: ({ request }) => {
        const mode = new URL(request.url).searchParams.get('synthetic');

        if (route.id.startsWith('public/application/index-') || route.id.startsWith('protected/application/index-')) {
          if (mode === 'not-found') {
            throw data(error, { status: 404 });
          }

          if (mode === 'generic') {
            throw new Error('Synthetic generic failure');
          }

          throw error;
        }

        return null;
      },
    };
  }
}
