import compression from 'compression';
import express from 'express';
import sourceMapSupport from 'source-map-support';

import { logging, responseMaxListeners, securityHeaders, session } from '~/.server/express-server/middleware';
import { globalErrorHandler } from '~/.server/express-server/request-handlers';
import { configureDevServer, configureDevStaticAssets } from '~/.server/express-server/server-dev';
import { configureProductionServer, configureProductionStaticAssets } from '~/.server/express-server/server-prod';
import { createLogger } from '~/.server/logging';
import { getEnv } from '~/.server/utils/env.utils';

console.log('Starting Canadian Dental Care Plan server...');
const log = createLogger('express.server');

log.info('Validating runtime environment...');
const environment = getEnv();
log.info('Runtime environment validation passed 🎉');

const isProduction = environment.NODE_ENV === 'production';
const port = process.env.PORT ?? '3000'; // TODO :: add this to env schema

log.info('Installing source map support');
sourceMapSupport.install();

log.info(`Initializing %s mode express server...`, environment.NODE_ENV);
const app = express();

log.info('  ✓ disabling X-Powered-By response header');
app.disable('x-powered-by');

log.info('  ✓ enabling reverse proxy support');
app.set('trust proxy', true);

log.info('  ‼️ configuring express middlewares...');

log.info('    ✓ increasing response max listeners to prevent EventEmitter warnings');
app.use(responseMaxListeners());

log.info('    ✓ compression middleware');
app.use(compression());

log.info('    ✓ logging middleware');
app.use(logging(isProduction));

if (isProduction) {
  configureProductionStaticAssets(app);
} else {
  configureDevStaticAssets(app);
}

log.info('    ✓ security headers middleware');
app.use(securityHeaders());

log.info('    ✓ session middleware (%s)', environment.SESSION_STORAGE_TYPE);
app.use(await session(isProduction, environment));

/**
 * Redirect Protected Apply
 *
 * Redirects all HTTP requests for protected apply pages (English and French) to the corresponding "application" pages.
 *
 * TODO: Remove this redirect after the legacy "/:lang/protected/apply" and "/:lang/protege/demander" URLs have been deprecated
 * and unused in production for at least 6 months.
 */
app.all(['/:lang/protected/apply{/*splat}', '/:lang/protege/demander{/*splat}'], (req, res) => {
  const { lang } = req.params;
  const isFrench = lang === 'fr';
  const basePath = isFrench ? 'protege/demande' : 'protected/application';
  const redirectUrl = `/${lang}/${basePath}`;
  log.info('Redirecting protected apply. request: [%s], redirectUrl: [%s]', req.originalUrl, redirectUrl);
  res.redirect(302, redirectUrl);
});

/**
 * Redirect Public Apply
 *
 * Redirects all HTTP requests for public apply pages (English and French) to the corresponding "application" pages.
 *
 * TODO: Remove this redirect after the legacy "/:lang/apply" and "/:lang/demander" URLshave been deprecated
 * and unused in production for at least 6 months.
 */
app.all(['/:lang/apply{/*splat}', '/:lang/demander{/*splat}'], (req, res) => {
  const { lang } = req.params;
  const isFrench = lang === 'fr';
  const basePath = isFrench ? 'demande' : 'application';
  const redirectUrl = `/${lang}/${basePath}`;
  log.info('Redirecting public apply. request: [%s], redirectUrl: [%s]', req.originalUrl, redirectUrl);
  res.redirect(302, redirectUrl);
});

// eslint-disable-next-line unicorn/prefer-ternary
if (isProduction) {
  await configureProductionServer(app);
} else {
  await configureDevServer(app);
}

log.info('  ✓ registering global error handler');
app.use(globalErrorHandler());

log.info('Server initialization complete');
app.listen(port, () => log.info(`Listening on http://localhost:${port}/`));
