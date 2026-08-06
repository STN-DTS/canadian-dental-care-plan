import express from 'express';

import { createLogger } from '~/.server/logging';

const log = createLogger('express/server-dev');

/**
 * Configures an Express development server for React-Router.
 *
 * @param app The Express application to configure.
 */
export async function configureDevServer(app: express.Express): Promise<void> {
  log.info('Configuring express development server...');

  const vite = await import('vite');
  const viteDevServer = await vite.createServer({ server: { middlewareMode: true } });

  log.info('Vite dev server middlewares configured.');
  const viteDevServerMiddleware = viteDevServer.middlewares;
  app.use(viteDevServerMiddleware);

  // React Router server build middleware must be added last to ensure that all other middlewares
  // (static assets, vite dev server, etc.) have a chance to handle the request first.
  log.info('React-Router Server build middleware (development)');
  app.use(async function reactRouterServerBuildMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
    try {
      // Dynamically import the app module to ensure that the latest version is used for each request.
      const source = await viteDevServer.ssrLoadModule('./app/.server/express-server/app.ts');
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === 'object' && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });

  log.info('Express development server configured successfully.');
}

/**
 * Configures an Express development server for serving static assets for React-Router.
 *
 * @param app The Express application to configure.
 */
export function configureDevStaticAssets(app: express.Express): void {
  log.info('Configuring express development server static assets...');

  log.info('Caching remaining static content for 1h');
  const staticClientContentMiddleware = express.static('./build/client', { maxAge: '1h' });
  app.use(staticClientContentMiddleware);

  log.info('Express development server static assets configured successfully.');
}
