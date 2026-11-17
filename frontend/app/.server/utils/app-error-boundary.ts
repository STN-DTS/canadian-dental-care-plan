/**
 * Lets route error boundaries receive an AppError's public details in production.
 *
 * In production, React Router replaces any `Error` thrown by a loader, action or
 * middleware with "Unexpected Server Error", but sends route error responses as-is.
 * Every AppError is therefore rethrown as a route error response that carries only
 * its status, error code and correlation ID.
 *
 * Resource routes have no error boundary, so direct requests to them keep the
 * original error. Data (`.data`) requests are always adapted.
 */
import { matchRoutes } from 'react-router';
import type { ErrorResponse, LoaderFunction, LoaderFunctionArgs, RouteObject, ServerBuild } from 'react-router';

import { trace } from '@opentelemetry/api';

import { ATTR_CDCP_CORRELATION_ID } from '~/.server/logging/log-attributes';
import { recordError } from '~/.server/utils/otel-instrumentation-utils';
import { isAppError } from '~/errors/app-error';
import type { AppError } from '~/errors/app-error';

type ServerAppError = AppError;

type HandlerArgs = Pick<LoaderFunctionArgs, 'request' | 'url'>;

const adaptedBuilds = new WeakMap<ServerBuild, ServerBuild>();

/**
 * Returns a copy of `build` whose route handlers convert AppErrors. The original build
 * is left untouched because span naming reads its middleware names.
 *
 * This ensures that only public error details are exposed to the client, while full error
 * information is recorded in server logs.
 *
 * @param build The server build containing route definitions.
 * @param routes The array of route objects to match against.
 * @returns A new server build with adapted route handlers.
 */
export function withAppErrorResponses(build: ServerBuild, routes: ReadonlyArray<RouteObject>): ServerBuild {
  const cached = adaptedBuilds.get(build);

  if (cached) {
    return cached;
  }

  const shouldAdapt = (args: HandlerArgs) => !isDirectResourceRequest(build, routes, args);
  const adaptedRoutes: ServerBuild['routes'] = {};

  for (const [id, route] of Object.entries(build.routes)) {
    if (!route) {
      adaptedRoutes[id] = route;
      continue;
    }

    const { loader, action, middleware } = route.module;
    const module = { ...route.module };

    if (loader) {
      const adaptedLoader: LoaderFunction = adaptErrors(loader, shouldAdapt);

      if (loader.hydrate !== undefined) {
        adaptedLoader.hydrate = loader.hydrate;
      }

      module.loader = adaptedLoader;
    }

    if (action) {
      module.action = adaptErrors(action, shouldAdapt);
    }

    if (middleware) {
      module.middleware = middleware.map((fn) => adaptErrors(fn, shouldAdapt));
    }

    adaptedRoutes[id] = { ...route, module };
  }

  const adapted = { ...build, routes: adaptedRoutes };
  adaptedBuilds.set(build, adapted);
  return adapted;
}

/**
 * Wraps a route handler to convert AppErrors into route error responses.
 *
 * @param handler The original route handler to wrap.
 * @param shouldAdapt A function that determines if the handler should be adapted for AppErrors.
 * @returns A new route handler that converts AppErrors into route error responses.
 */
function adaptErrors<Args extends HandlerArgs, Rest extends unknown[], Result>(handler: (args: Args, ...rest: Rest) => Result | Promise<Result>, shouldAdapt: (args: Args) => boolean): (args: Args, ...rest: Rest) => Promise<Result> {
  return async (args, ...rest) => {
    try {
      return await handler(args, ...rest);
    } catch (error) {
      if (isServerAppError(error) && shouldAdapt(args)) {
        recordOnActiveSpan(error);
        throw toRouteErrorResponse(error);
      }

      throw error;
    }
  };
}

/**
 * Determines if a request is for a direct resource, such as a static file, rather than a route with a loader or action.
 *
 * @param build The server build containing route definitions.
 * @param routes The array of route objects to match against.
 * @param param2 The handler arguments containing the request and URL.
 * @returns True if the request is a direct resource request, false otherwise.
 */
function isDirectResourceRequest(build: ServerBuild, routes: ReadonlyArray<RouteObject>, { request, url }: HandlerArgs): boolean {
  if (new URL(request.url).pathname.endsWith('.data')) {
    return false;
  }

  const routeId = matchRoutes([...routes], url.pathname, build.basename)?.at(-1)?.route.id;
  const routeModule: { default?: unknown; ErrorBoundary?: unknown } | undefined = routeId ? build.routes[routeId]?.module : undefined;
  return routeModule !== undefined && routeModule.default == null && routeModule.ErrorBoundary == null;
}

/**
 * Instrumentation only records thrown `Error`s, and the route error response that
 * replaces this error is not one.
 */
function recordOnActiveSpan(error: ServerAppError): void {
  const span = trace.getActiveSpan();

  if (!span) {
    return;
  }

  recordError(span, error);

  if (error.correlationId) {
    span.setAttribute(ATTR_CDCP_CORRELATION_ID, error.correlationId);
  }
}

/**
 * Converts a ServerAppError into a route error response suitable for React Router.
 *
 * @param error The ServerAppError to convert.
 * @returns An ErrorResponse object suitable for React Router.
 */
function toRouteErrorResponse(error: ServerAppError): ErrorResponse {
  const response: ErrorResponse & { internal: false } = {
    status: error.httpStatusCode,
    statusText: '',
    internal: false,
    data: { name: error.name, errorCode: error.errorCode, correlationId: error.correlationId },
  };

  // React Router passes `error` to handleError; non-enumerable keeps it out of the response body.
  Object.defineProperty(response, 'error', { value: error });
  return response;
}

/**
 * Checks the shape instead of using `instanceof` because the server build and the
 * Express server bundle separate copies of the AppError class.
 *
 * @param error The error object to check.
 * @returns True if the error is a ServerAppError, false otherwise.
 */
function isServerAppError(error: unknown): error is ServerAppError {
  return isAppError(error);
}
