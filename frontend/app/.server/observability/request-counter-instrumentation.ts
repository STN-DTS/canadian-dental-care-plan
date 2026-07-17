/**
 * Request counter instrumentation for React Router.
 *
 * This module hooks into React Router's server instrumentation API to emit an
 * HTTP status counter metric for eligible requests. Each request is resolved to
 * the route that handled it (e.g. `routes/user.$id.profile`) and reported to
 * the {@link TYPES.InstrumentationService} keyed by route id, HTTP method, and
 * status code. This lets us track request volume and error rates per route
 * rather than per raw URL, which would otherwise explode metric cardinality
 * because of dynamic path segments (ids, slugs, etc.). Requests without
 * handler metadata or a matching route, along with ignored routes, are skipped.
 */
import type { RouteObject, RouterContextProvider, ServerInstrumentation } from 'react-router';
import { matchRoutes } from 'react-router';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import type { Logger } from '~/.server/logging';
import { singleton } from '~/.server/utils/instance-registry';

/**
 * Creates the request counter instrumentation object consumed by React Router.
 *
 * The returned instrumentation wraps the server request handler so that, once a
 * request has been handled, its route and status code can be forwarded to
 * {@link requestCounter} for metric emission.
 *
 * @returns A {@link ServerInstrumentation} that counts requests by route id, method, and status code.
 */
export function createRequestCounterInstrumentation(): ServerInstrumentation {
  const log = createLogger('observability/request-counter-instrumentation');
  log.info('Creating request counter instrumentation for React Router');

  return {
    // Wrap the server request handler so we can inspect each request after it is handled.
    handler(handler) {
      handler.instrument({
        async request(requestHandler, { request, context }) {
          // The router context carries the app container, which is required to resolve
          // the InstrumentationService. Without it we cannot emit metrics, so fail loudly.
          if (!context) {
            throw new Error('React Router "request" instrumentation is missing its context; cannot resolve the app container for request counting');
          }

          const { meta, statusCode } = await requestHandler();

          if (!meta) {
            log.trace('No metadata found. Skipping request counting for request: [%s]', request.url);
            return;
          }

          requestCounter(log, context, request, { meta, statusCode });
        },
      });
    },
  };
}

/**
 * The value stored in {@link pathCache} for a given route pattern.
 *
 * - `string`   – the id of the route that matched the pattern.
 * - `null`     – no route matched the pattern or the matched route has no id.
 * - `undefined` – the key is absent from the cache (never used as a stored value).
 */
type CachedRouteId = string | null | undefined;

type ReadonlyRequest = { method: string; url: string; headers: Pick<Headers, 'get'> };
type ReadonlyContext = Pick<RouterContextProvider, 'get'>;
type HandlerResult = { statusCode: number; meta: { url: URL; pattern: string } };

// Cache mapping request route pattern to resolved route id, or null when no
// route matches or the matched route has no id.
//
// Route matching is deterministic for a given pattern, so we memoize the result to avoid
// re-running matchRoutes on every request. Keying by pattern (rather than the raw pathname)
// keeps the cache small because dynamic segments (ids, slugs, etc.) collapse into a single
// pattern. This Map lives for the lifetime of the module (i.e. the server process) and is
// shared across all requests.
const pathCache = new Map<string, CachedRouteId>();

// Set of route ids that should be ignored for request counting. These are typically
// routes that are either low-level (e.g. health checks) or catch-all (e.g. 404s).
const ignoredRouteIds: Set<string> = new Set(['api/locales', 'routes/catchall']);
/**
 * Resolves a handled request to its route id and emits an HTTP status counter metric.
 *
 * The route id is looked up from {@link pathCache} and, on a miss, computed via
 * `matchRoutes` and cached (including negative results). The metric key is derived
 * from the route id and HTTP method, then reported with the response status code.
 *
 * Any error is caught and logged so that metric emission never breaks the request.
 *
 * @param log - Logger scoped to this instrumentation.
 * @param context - React Router context used to resolve the app container.
 * @param request - The incoming request (method is used to build the metric key).
 * @param result - The handler result containing the resolved URL and status code.
 */
function requestCounter(log: Logger, context: ReadonlyContext, request: ReadonlyRequest, { meta, statusCode }: HandlerResult) {
  try {
    const {
      pattern,
      url: { pathname },
    } = meta;

    let routeId: CachedRouteId;

    // Reuse a previously resolved route id when available, otherwise match and cache it.
    if (pathCache.has(pattern)) {
      routeId = pathCache.get(pattern);
      log.debug('Cache hit for path: %s, pattern: %s, routeId: %s', pathname, pattern, routeId);
    } else {
      log.debug('Cache miss for path: %s, pattern: %s. Matching routes...', pathname, pattern);

      const serverBuild = singleton('serverBuild');
      const agnosticRoutes = singleton('agnosticRoutes');
      const matches = matchRoutes(agnosticRoutes as RouteObject[], pathname, serverBuild.basename);

      // The most specific match is last in the array; fall back to null when there
      // is no match or the matched route has no id.
      const lastMatch = matches?.at(-1);
      routeId = lastMatch?.route.id ?? null;

      // Cache the result, including negative (null) matches, so repeat lookups stay fast.
      pathCache.set(pattern, routeId);
      log.debug('Cached routeId %s for path: %s, pattern: %s', routeId, pathname, pattern);
    }

    if (!routeId) {
      log.trace('No route id found for path: %s, pattern: %s. Skipping request counting.', pathname, pattern);
      return;
    }

    if (ignoredRouteIds.has(routeId)) {
      log.trace('Ignoring request counting for routeId: %s, path: %s, pattern: %s', routeId, pathname, pattern);
      return;
    }

    // Build the metric key from the route id and HTTP method, normalizing the id
    // into a dotted, metric-friendly form:
    //   route id 'user/$id/profile' + method POST -> 'user._id.profile.posts'
    //   - '/' becomes '.' (path separators -> metric segments)
    //   - '$' becomes '_' (dynamic params, e.g. $id -> _id)
    //   - 's' is appended to the lowercased method (e.g. 'post' becomes 'posts')
    const metricPrefix = `${routeId.replaceAll('/', '.').replaceAll('$', '_')}.${request.method.toLowerCase()}s`;

    const { appContainer } = context.get(appContext);
    const instrumentationService = appContainer.get(TYPES.InstrumentationService);
    instrumentationService.countHttpStatus(metricPrefix, statusCode);

    log.debug('Counted HTTP status %s for metric prefix: %s, routeId: %s, pathname: %s, method: %s, pattern: %s', statusCode, metricPrefix, routeId, pathname, request.method, pattern);
  } catch (error) {
    // Never let a metrics failure surface to the caller; log and move on.
    log.error('Error during request counting:', error);
  }
}
