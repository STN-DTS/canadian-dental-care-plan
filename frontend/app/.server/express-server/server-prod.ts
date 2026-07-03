import express from 'express';

import { createLogger } from '~/.server/logging';

const log = createLogger('express-prod.ts');

/**
 * Configures an Express production server for React-Router.
 *
 * @param app The Express application to configure.
 */
export async function configureProductionServer(app: express.Express): Promise<void> {
  log.info('  ✓ configuring express production server...');

  // React Router server build middleware must be added last to ensure that all other middlewares
  // (static assets, vite dev server, etc.) have a chance to handle the request first.
  log.info('    ✓ React-Router Server build middleware (production)');

  // Import prebuilt server app in production (path relative to ./build/server/server.js).
  const BUILD_PATH = './index.js'; // Short-circuit the type-checking of the built output.
  const buildServer = await import(BUILD_PATH).catch((error) => {
    log.error('Failed to import prebuilt server app from %s', BUILD_PATH, error);
    throw error;
  });
  app.use(buildServer.app);

  log.info('    ✓ Express production server configured successfully.');
}

/**
 * Configures an Express production server for serving static assets for React-Router.
 *
 * @param app The Express application to configure.
 */
export function configureProductionStaticAssets(app: express.Express): void {
  log.info('  ✓ configuring express production server static assets...');

  log.info('    ✓ caching /assets for 1y');
  app.use('/assets', express.static('./build/client/assets', { immutable: true, maxAge: '1y' }));

  log.info('    ✓ caching remaining static content for 1y');
  app.use(express.static('./build/client', { maxAge: '1y' }));

  log.info('    ✓ Express production server static assets configured successfully.');
}
