import type { RequestHandler } from 'express';
import sessionMiddleware from 'express-session';
import { minimatch } from 'minimatch';
import morganMiddleware from 'morgan';
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
 * Multiple middleware (compression, morgan, express-session, etc.) each attach
 * internal 'finish' listeners to the response via on-finished, and our custom
 * routeRequestCounter adds one more. Combined, these exceed Node's default
 * limit of 10, triggering a MaxListenersExceededWarning. Raising to 15
 * accommodates all current listeners with headroom.
 */
export function responseMaxListeners(maxListeners = 15): RequestHandler {
  return (_req, res, next) => {
    res.setMaxListeners(maxListeners);
    next();
  };
}

// @see: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
export function securityHeaders(): RequestHandler {
  const log = createLogger('express.server/securityHeadersRequestHandler');
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

  return (request, response, next) => {
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

export function logging(isProduction: boolean): RequestHandler {
  const log = createLogger('express.server/loggingRequestHandler');
  const ignorePatterns: string[] = ['/api/readyz'];

  const logFormat = isProduction ? 'tiny' : 'dev';

  const middleware = morganMiddleware(logFormat, {
    stream: { write: (msg) => log.info(msg.trim()) },
  });

  return (request, response, next) => {
    if (shouldIgnore(ignorePatterns, request.path)) return next();
    return middleware(request, response, next);
  };
}

/**
 * Configures session middleware, optionally skipping it for bots and specific paths.
 */
export async function session(isProduction: boolean, serverConfig: ServerConfig): Promise<RequestHandler> {
  const log = createLogger('express.server/sessionRequestHandler');

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

  const middleware = sessionMiddleware({
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

  return async (request, response, next) => {
    if (shouldIgnore(ignorePatterns, request.path)) {
      log.trace('Skipping session: [%s]', request.path);
      return next();
    }

    return await middleware(request, response, next);
  };
}
