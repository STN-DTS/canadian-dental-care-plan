import { ATTR_ERROR_TYPE, ATTR_HTTP_REQUEST_METHOD, ATTR_HTTP_RESPONSE_STATUS_CODE, ATTR_OTEL_EVENT_NAME, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import type { RequestHandler } from 'express';
import expressSession from 'express-session';
import { minimatch } from 'minimatch';
import morgan from 'morgan';
import { randomUUID } from 'node:crypto';

import type { ServerConfig } from '~/.server/configs';
import { createMemoryStore, createRedisStore } from '~/.server/express-server/session';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_HTTP_RESPONSE_CONTENT_LENGTH_BYTES, ATTR_CDCP_HTTP_RESPONSE_TIME_MS } from '~/.server/logging/log-attributes';

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

  // oxfmt-ignore
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
      log.trace('Skipping security response headers', { [ATTR_URL_PATH]: request.path });
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

/**
 * Creates named request-logger middleware with structured completion records and status-based severity.
 *
 * The cdcp.http.request.completed event contains method, query-free path, status when sent,
 * response time in milliseconds and declared response content length in bytes when available.
 * Incomplete responses carry a fixed error type. Health readiness requests are excluded.
 */
export function createRequestLoggerMiddleware(_isProduction: boolean): RequestHandler {
  const log = createLogger('express/middleware/requestLoggerMiddleware');

  // List of paths to ignore for request logging. These are typically health check endpoints that
  // are called frequently and can clutter the logs.
  const ignorePatterns: string[] = ['/api/readyz'];

  return function requestLoggerMiddleware(request, response, next) {
    if (shouldIgnore(ignorePatterns, request.path)) {
      return next();
    }

    const pathname = request.path;
    const method = request.method;

    return morgan((tokens, req, res) => {
      const status = res.headersSent ? res.statusCode : undefined;
      const responseTime = tokens['response-time']?.(req, res);
      const contentLength = res.getHeader('content-length');
      const incomplete = !res.writableFinished;
      const attributes = {
        [ATTR_OTEL_EVENT_NAME]: 'cdcp.http.request.completed',
        [ATTR_HTTP_REQUEST_METHOD]: method,
        [ATTR_URL_PATH]: pathname,
        ...(status !== undefined && { [ATTR_HTTP_RESPONSE_STATUS_CODE]: status }),
        ...(responseTime !== undefined && { [ATTR_CDCP_HTTP_RESPONSE_TIME_MS]: Number(responseTime) }),
        ...(contentLength !== undefined && Number.isFinite(Number(contentLength)) && { [ATTR_CDCP_HTTP_RESPONSE_CONTENT_LENGTH_BYTES]: Number(contentLength) }),
        ...(incomplete ? { [ATTR_ERROR_TYPE]: 'http_response_incomplete' } : res.statusCode >= 400 ? { [ATTR_ERROR_TYPE]: String(res.statusCode) } : {}),
      };

      if (incomplete || res.statusCode >= 500) {
        log.error('HTTP request completed', attributes);
      } else if (res.statusCode >= 400) {
        log.warn('HTTP request completed', attributes);
      } else {
        log.info('HTTP request completed', attributes);
      }
    })(request, response, next);
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
      log.trace('Skipping session middleware', { [ATTR_URL_PATH]: request.path });
      return next();
    }

    return await generatedSessionMiddleware(request, response, next);
  };
}
