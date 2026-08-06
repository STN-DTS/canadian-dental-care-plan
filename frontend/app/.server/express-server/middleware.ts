import type { RequestHandler } from 'express';
import expressSession from 'express-session';
import { minimatch } from 'minimatch';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';

import type { ServerConfig } from '~/.server/configs';
import { createMemoryStore, createRedisStore } from '~/.server/express-server/session';
import { createLogger } from '~/.server/logging';

/**
 * Checks if a given path should be ignored based on a list of ignore patterns.
 *
 * @param ignorePatterns - An array of glob patterns to match against the path.
 * @param path - The path to check.
 * @returns - True if the path should be ignored, false otherwise.
 */
function shouldIgnore(ignorePatterns: string[], path: string): boolean {
  return ignorePatterns.some((entry) => minimatch(path, entry, { dot: true }));
}

/**
 * Creates named middleware that increases the maximum number of listeners for the response object.
 *
 * This is useful when multiple middleware (compression, morgan, express-session, etc.) each attach
 * internal 'finish' listeners to the response via on-finished, and our custom routeRequestCounter adds one more.
 * Combined, these exceed Node's default limit of 10, triggering a MaxListenersExceededWarning.
 * Raising to 15 accommodates all current listeners with headroom.
 */
export function createResponseMaxListenersMiddleware(maxListeners = 15): RequestHandler {
  return function responseMaxListenersMiddleware(_req, res, next) {
    res.setMaxListeners(maxListeners);
    next();
  };
}

/**
 * Creates named middleware that applies security response headers.
 *
 * Returned middleware can be registered directly with `app.use(...)`.
 *
 * @see: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
 */
export function createSecurityHeadersMiddleware(): RequestHandler {
  const log = createLogger('express/middleware/securityHeadersMiddleware');
  const ignorePatterns: string[] = [];

  // prettier-ignore
  const permissionsPolicy = [
    'camera=()',
    'display-capture=()',
    'fullscreen=()',
    'geolocation=()',
    'interest-cohort=()',
    'microphone=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
  ].join(', ');

  return function securityHeadersMiddleware(request, response, next) {
    if (shouldIgnore(ignorePatterns, request.path)) {
      log.trace('Skipping adding security headers to response: [%s]', request.path);
      return next();
    }

    log.debug('Adding security headers to response');

    response.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    response.setHeader('Permissions-Policy', permissionsPolicy);
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Server', 'webserver');
    response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'deny');

    next();
  };
}

type MorganFormat = 'combined' | 'common' | 'dev' | 'short' | 'tiny' | string;

/**
 * Creates named request-logger middleware with production-aware Morgan format.
 *
 * Health readiness requests are excluded from request logging.
 */
export function createRequestLoggerMiddleware(isProduction: boolean): RequestHandler {
  const log = createLogger('express/middleware/requestLoggerMiddleware');
  const logFormat: MorganFormat = isProduction ? 'tiny' : 'dev';

  const morganLoggerMiddleware = morgan(logFormat, {
    stream: { write: (msg) => log.http(msg.trim()) },
  });

  // List of paths to ignore for request logging. These are typically health check endpoints that
  // are called frequently and can clutter the logs.
  const ignorePatterns: string[] = ['/api/readyz'];

  return function requestLoggerMiddleware(request, response, next) {
    if (shouldIgnore(ignorePatterns, request.path)) return next();
    return morganLoggerMiddleware(request, response, next);
  };
}

/**
 * Creates named session middleware, optionally skipping it for bots and specific paths.
 *
 * Session store is selected from server configuration. Excluded paths bypass session setup.
 */
export async function createSessionMiddleware(isProduction: boolean, serverConfig: ServerConfig): Promise<RequestHandler> {
  const log = createLogger('express/middleware/sessionMiddleware');

  const ignorePatterns = [
    '/api/buildinfo', //
    '/api/health',
    '/api/readyz',
    '/.well-known/jwks.json',
    '/oidc/**',
  ];

  const { SESSION_STORAGE_TYPE, SESSION_COOKIE_DOMAIN, SESSION_COOKIE_NAME, SESSION_COOKIE_PATH, SESSION_COOKIE_SAME_SITE, SESSION_COOKIE_SECRET, SESSION_COOKIE_SECURE } = serverConfig;

  const sessionStore =
    SESSION_STORAGE_TYPE === 'redis' //
      ? await createRedisStore(serverConfig)
      : createMemoryStore();

  const generatedSessionMiddleware = expressSession({
    store: sessionStore,
    name: SESSION_COOKIE_NAME,
    secret: SESSION_COOKIE_SECRET,
    genid: () => randomUUID(),
    proxy: true,
    resave: false,
    rolling: true,
    saveUninitialized: false,
    cookie: {
      domain: SESSION_COOKIE_DOMAIN,
      path: SESSION_COOKIE_PATH,
      secure: SESSION_COOKIE_SECURE ? isProduction : false,
      httpOnly: true,
      sameSite: SESSION_COOKIE_SAME_SITE,
    },
  });

  return async function sessionMiddleware(request, response, next) {
    if (shouldIgnore(ignorePatterns, request.path)) {
      log.trace('Skipping session: [%s]', request.path);
      return next();
    }

    return await generatedSessionMiddleware(request, response, next);
  };
}
