import { renderToPipeableStream } from 'react-dom/server';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';

import { createReadableStreamFromReadable } from '@react-router/node';
import type { ActionFunctionArgs, EntryContext, InstrumentationServerHandlerResult, LoaderFunctionArgs, RouterContextProvider, ServerInstrumentation } from 'react-router';
import { matchRoutes, ServerRouter } from 'react-router';

import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import { I18nextProvider } from 'react-i18next';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { createLogger } from '~/.server/logging';
import { createOtelInstrumentation } from '~/.server/observability/otel-instrumentation';
import { generateContentSecurityPolicy } from '~/.server/utils/csp.utils';
import { getLocale, initI18n } from '~/.server/utils/locale.utils';
import { NonceProvider } from '~/components/nonce-context';
import { getNamespaces } from '~/utils/locale-utils';
import { randomHexString } from '~/utils/string-utils';
import { hasSingleton, singleton } from '~/.server/utils/instance-registry';
import { createAgnosticRoutes, createServerRoutes } from '~/.server/utils/server-build.utils';

/**
 * We need to extend the server-side session lifetime whenever a client-side
 * navigation happens. Since all client-side navigation will make a data request
 * for the root loader, we can use the handleDataRequest function to effectively
 * 'touch' the session, extending it by the default session lifetime.
 *
 * Extending the session lifetime  update the TTL value of the session data when
 * using Redis as a backing store.
 *
 * @see https://remix.run/docs/en/main/file-conventions/entry.server#handledatarequest
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function handleDataRequest(response: Response, { context, request }: LoaderFunctionArgs | ActionFunctionArgs) {
  const { appContainer } = context.get(appContext);
  const log = createLogger('entry.server/handleDataRequest');
  log.debug('Touching session to extend its lifetime');
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('http.server.requests').add(1);

  return response;
}

/**
 * Log any errors using the application logger (Remix will log using console.error() by default, which we don't want).
 *
 * @see https://remix.run/docs/en/main/file-conventions/entry.server#handleerror
 */
export function handleError(error: unknown, { context, request }: LoaderFunctionArgs | ActionFunctionArgs) {
  const { appContainer } = context.get(appContext);
  // note that you generally want to avoid logging when the request was aborted, since remix's
  // cancellation and race-condition handling can cause a lot of requests to be aborted
  const log = createLogger('entry.server/handleError');
  if (!request.signal.aborted) {
    if (error instanceof Error) {
      log.error(error);
    } else {
      log.error('Unexpected server error: [%j]', error);
    }

    const instrumentationService = appContainer.get(TYPES.InstrumentationService);
    instrumentationService.createCounter('http.server.requests.failed').add(1);
  }
}

export default async function handleRequest(request: Request, responseStatusCode: number, responseHeaders: Headers, routerContext: EntryContext, context: RouterContextProvider) {
  const { appContainer } = context.get(appContext);
  const log = createLogger('entry.server/handleRequest');
  const handlerFnName = isbot(request.headers.get('user-agent')) ? 'onAllReady' : 'onShellReady';
  log.debug(`Handling [${request.method}] request to [${request.url}] with handler function [${handlerFnName}]`);
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  instrumentationService.createCounter('http.server.requests').add(1);

  const locale = getLocale(new URL(request.url));
  const routes = Object.values(routerContext.routeModules);
  const i18n = await initI18n(locale, getNamespaces(routes));
  const nonce = randomHexString(32);

  return await new Promise((resolve, reject) => {
    const userAgent = request.headers.get('user-agent');

    // Ensure requests from bots and SPA Mode renders wait for all content to load before responding
    // https://react.dev/reference/react-dom/server/renderToPipeableStream#waiting-for-all-content-to-load-for-crawlers-and-static-generation
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || routerContext.isSpaMode //
        ? 'onAllReady'
        : 'onShellReady';

    let shellRendered = false;

    const { pipe, abort } = renderToPipeableStream(
      <I18nextProvider i18n={i18n}>
        <NonceProvider nonce={nonce}>
          <ServerRouter context={routerContext} url={request.url} nonce={nonce} />
        </NonceProvider>
      </I18nextProvider>,
      {
        [readyOption]() {
          shellRendered = true;

          // @see: https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html
          responseHeaders.set('Content-Type', 'text/html');
          responseHeaders.set('Content-Security-Policy', generateContentSecurityPolicy(nonce));

          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));

          pipe(body);
        },
        onShellError(error) {
          reject(error);
        },
        onError(error) {
          // eslint-disable-next-line no-param-reassign
          responseStatusCode = 500;

          // Log streaming rendering errors from inside the shell. Don't log
          // errors encountered during initial shell rendering since they'll
          // reject and get logged in handleDocumentRequest.
          if (shellRendered) {
            log.error('Error while rendering react element', error);
          }
        },
        nonce,
      },
    );

    // Abort the streaming render pass after 11 seconds
    // to allow the rejected boundaries to be flushed
    // see: https://reactrouter.com/explanation/special-files#streamtimeout
    setTimeout(abort, 10_000);
  });
}

export const instrumentations: ServerInstrumentation[] = [
  createOtelInstrumentation(),
  {
    // Instrument the server handler
    handler(handler) {
      handler.instrument({
        async request(handleRequest, { request, context }) {
          const result = await handleRequest();
          if (!context) return;
          requestCounter(context, request, result);
        },
      });
    },
  },
];

// Define a type for the cache value (can be string or null/undefined if no match/id)
type CachedRouteId = string | null | undefined;
type ReadonlyRequest = {
  method: string;
  url: string;
  headers: Pick<Headers, 'get'>;
};
type ReadonlyContext = Pick<RouterContextProvider, 'get'>;

// Cache to store: normalizedPath -> routeId (or null/undefined if no match)
// This Map persists across requests for this middleware instance.
const pathCache = new Map<string, CachedRouteId>();

function requestCounter(context: ReadonlyContext, request: ReadonlyRequest, result: InstrumentationServerHandlerResult) {
  const log = createLogger('entry.server/requestCounter');
  const { appContainer } = context.get(appContext);
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);

  if (!result.meta) {
    return;
  }

  const { pathname } = result.meta.url;

  if (!hasSingleton('serverBuild')) {
    // If the server build is not yet available, we cannot match routes, so we skip counting for this request.
    log.warn('Server build not available. Skipping request counting for path: %s', pathname);
    return;
  }

  const build = singleton('serverBuild');
  const routes = singleton('routes', () => {
    const serverRoutes = createServerRoutes(build.routes);
    return createAgnosticRoutes(serverRoutes);
  });

  try {
    let routeId: CachedRouteId;

    // Check cache first
    if (pathCache.has(pathname)) {
      routeId = pathCache.get(pathname);
      log.debug(`Cache hit for path: ${pathname}, routeId: ${routeId}`);
    } else {
      log.debug(`Cache miss for path: ${pathname}. Matching routes...`);

      const matches = matchRoutes(routes, pathname, build.basename);

      // Get the ID from the most specific matched route (last in the array)
      // Ensure the route and ID exist
      const lastMatch = matches?.at(-1); // Get the last match object
      routeId = lastMatch?.route.id ?? null; // Use null if no ID

      // Update cache with the result (even if null)
      pathCache.set(pathname, routeId);
      log.debug(`Cached routeId '${routeId}' for path: ${pathname}`);
    }

    if (routeId) {
      // Construct metric identifier (e.g., POST '/user/$id/profile' → 'user._id.profile.posts')
      const metricPrefix = `${routeId.replaceAll('/', '.').replaceAll('$', '_')}.${request.method.toLowerCase()}s`;
      instrumentationService.countHttpStatus(metricPrefix, result.statusCode);
    }
  } catch (error) {
    log.error('Error during request counting in "finish" handler:', error);
  }
}
