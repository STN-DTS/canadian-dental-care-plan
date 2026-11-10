/**
 * @file
 * OpenTelemetry helpers for the React Router server instrumentation.
 *
 * Turns React Router request/route/middleware instrumentation callbacks into OpenTelemetry
 * spans that follow the HTTP semantic conventions (`http.*`, `url.*`, `server.*`), plus a few
 * custom `react_router.*` attributes (route id, matched URL, route params, middleware order/name).
 *
 * Consumed by `otel-instrumentation.ts`, which wires these helpers to React Router's hooks.
 *
 * These helpers are not a copy of any single reference implementation; they draw on the approaches
 * used by the OpenTelemetry HTTP instrumentation and adapt them to this app's spans and attributes.
 *
 * @see https://opentelemetry.io/docs/specs/semconv/http/http-spans/
 */
import type { InstrumentationHandlerResult, InstrumentationServerHandlerResult, Params, RouterContextProvider, ServerBuild } from 'react-router';

import { SpanStatusCode, context, createContextKey, trace } from '@opentelemetry/api';
import type { Attributes, Span, SpanOptions } from '@opentelemetry/api';
import {
  ATTR_CLIENT_ADDRESS,
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_REQUEST_METHOD_ORIGINAL,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_PATH,
  ATTR_URL_SCHEME,
  ATTR_USER_AGENT_ORIGINAL,
} from '@opentelemetry/semantic-conventions';

import { TYPES } from '~/.server/constants';
import { appContext } from '~/.server/context';
import { singleton } from '~/.server/utils/instance-registry';
import type { AppError } from '~/errors/app-error';
import { getAppError, getCorrelationId } from '~/errors/error-predicates';

// -----------------------------------------------------------------------------
// Constants & types
// -----------------------------------------------------------------------------

/**
 * Minimal read-only view of the router context provider exposed by React Router's instrumentation
 * API, narrowed to the `get` accessor used to resolve the app container.
 */
type ReadonlyContext = Pick<RouterContextProvider, 'get'>;

/**
 * Minimal read-only view of the request exposed by React Router's instrumentation API.
 */
type ReadonlyRequest = {
  method: string;
  url: string;
  headers: Pick<Headers, 'get'>;
};

/**
 * HTTP methods that are recorded verbatim; anything else is reported as `_OTHER`.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/main/experimental/packages/opentelemetry-instrumentation-http/src/utils.ts
 */
const KNOWN_METHODS = new Set(['CONNECT', 'DELETE', 'GET', 'HEAD', 'OPTIONS', 'PATCH', 'POST', 'PUT', 'TRACE', 'QUERY']);

/**
 * OpenTelemetry instrumentation scope name (`otel.scope.name`) applied to every react-router
 * server span, so these spans can be distinguished from other instrumentation (e.g. auto HTTP,
 * database) independently of the service name.
 */
const INSTRUMENTATION_SCOPE = 'canadian-dental-care-plan/react-router';

/**
 * The React Router route id of the matched route.
 *
 * @example routes/index
 * @example routes/$lang.protected.dashboard
 */
export const ATTR_RR_ROUTE_ID = 'react_router.route.id';

/**
 * The matched route URL, with React Router internals stripped.
 *
 * @example https://example.com/en/dashboard
 */
export const ATTR_RR_URL = 'react_router.url';

/**
 * Prefix for per-parameter attributes carrying the matched dynamic route params; the param name is
 * appended to form the full attribute key.
 *
 * @example react_router.params.lang
 * @example react_router.params.id
 */
export const ATTR_RR_PARAM_PREFIX = 'react_router.params.';

/**
 * The zero-based execution index of the middleware within its route's middleware chain.
 *
 * @example 0
 * @example 2
 */
export const ATTR_RR_MIDDLEWARE_INDEX = 'react_router.middleware.index';

/**
 * The name of the middleware function, when not anonymous.
 *
 * @example securityHeadersMiddleware
 * @example i18nextMiddleware
 */
export const ATTR_RR_MIDDLEWARE_NAME = 'react_router.middleware.name';

// -----------------------------------------------------------------------------
// Attribute builders (pure — no OpenTelemetry span/container dependencies)
// -----------------------------------------------------------------------------

/**
 * Builds OpenTelemetry HTTP semantic-convention attributes for the top-level request span.
 *
 * @param request - The read-only request view (method, raw URL, headers).
 * @returns Attributes for `http.request.method` (+ original when normalized), `url.*`, `server.*`,
 *   `user_agent.original`, and `client.address` when derivable.
 */
export function buildRequestAttributes(request: ReadonlyRequest): Attributes {
  const normalizedMethod = normalizeMethod(request.method);
  const attributes: Attributes = { [ATTR_HTTP_REQUEST_METHOD]: normalizedMethod };

  if (request.method !== normalizedMethod) {
    attributes[ATTR_HTTP_REQUEST_METHOD_ORIGINAL] = request.method;
  }

  try {
    Object.assign(attributes, urlAttributes(new URL(request.url)));
  } catch {
    // ignore unparseable URLs
  }

  const userAgent = request.headers.get('user-agent');

  if (userAgent) {
    attributes[ATTR_USER_AGENT_ORIGINAL] = userAgent;
  }

  const clientAddress = getClientAddress(request.headers);

  if (clientAddress) {
    attributes[ATTR_CLIENT_ADDRESS] = clientAddress;
  }

  return attributes;
}

/**
 * Builds OpenTelemetry HTTP semantic-convention attributes for a route-level span (middleware, loader, action).
 *
 * @param id - The React Router route id.
 * @param pattern - The un-interpolated route pattern, mapped to `http.route`.
 * @param url - The normalized route URL (React Router internals stripped).
 * @param request - The read-only request view, used for the HTTP method.
 * @param params - The matched dynamic route params, emitted as `react_router.params.*`.
 * @returns The route span attributes.
 */
export function buildRouteAttributes(id: string, pattern: string, url: URL, request: ReadonlyRequest, params: Params): Attributes {
  return {
    [ATTR_RR_ROUTE_ID]: id,
    [ATTR_HTTP_ROUTE]: pattern,
    [ATTR_HTTP_REQUEST_METHOD]: normalizeMethod(request.method),
    ...urlAttributes(url),
    ...paramAttributes(params),
  };
}

/**
 * Returns the OpenTelemetry URL/server attributes (`url.scheme`, `url.path`, `server.address`,
 * and `server.port` when present) derived from a parsed URL.
 */
function urlAttributes(url: URL): Attributes {
  return {
    [ATTR_URL_SCHEME]: url.protocol.replace(/:$/, ''),
    [ATTR_URL_PATH]: url.pathname,
    [ATTR_SERVER_ADDRESS]: url.hostname,
    ...(url.port ? { [ATTR_SERVER_PORT]: Number(url.port) } : {}),
  };
}

/**
 * Returns custom `react_router.params.*` attributes for the given route params, skipping
 * undefined values.
 */
function paramAttributes(params: Params): Attributes {
  const attributes: Attributes = {};

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      attributes[`${ATTR_RR_PARAM_PREFIX}${key}`] = value;
    }
  }

  return attributes;
}

/**
 * Normalizes an HTTP method to a known upper-case verb, or `_OTHER` when unrecognized.
 */
export function normalizeMethod(method: string): string {
  const upper = method.toUpperCase();
  return KNOWN_METHODS.has(upper) ? upper : '_OTHER';
}

/**
 * Derives the remote client address from proxy headers, preferring `forwarded` over
 * `x-forwarded-for`. Uses the left-most (original client) entry of whichever header is present, and
 * strips any trailing port.
 */
function getClientAddress(headers: Pick<Headers, 'get'>): string | undefined {
  const forwarded = headers.get('forwarded');

  if (forwarded) {
    const match = /for="?\[?([^\];,"]+)/i.exec(forwarded);

    if (match?.[1]) {
      return removePort(match[1]);
    }
  }

  const xForwardedFor = headers.get('x-forwarded-for');

  if (xForwardedFor) {
    const first = xForwardedFor.split(',', 1)[0]?.trim();

    if (first) {
      return removePort(first);
    }
  }

  return undefined;
}

/**
 * Strips a trailing port from an IPv4 or bracketed IPv6 address, leaving bare IPv6 addresses intact.
 */
function removePort(address: string): string {
  if (address.startsWith('[')) {
    return address.slice(1, address.indexOf(']'));
  }

  // Only strip a port for IPv4 / hostnames (single colon); bare IPv6 has multiple colons.
  const colonCount = (address.match(/:/g) ?? []).length;
  return colonCount === 1 ? address.slice(0, address.indexOf(':')) : address;
}

// -----------------------------------------------------------------------------
// Span lifecycle (OpenTelemetry span creation & enrichment)
// -----------------------------------------------------------------------------

/**
 * Wraps an instrumented handler in an active OpenTelemetry span.
 *
 * @param context - The router context provider, used to resolve the app container.
 * @param name - The initial span name.
 * @param options - Span options (attributes, kind).
 * @param handler - The instrumented handler to execute within the span.
 * @param onResult - Optional callback to enrich the span from the handler result; when omitted, errors are recorded by default.
 */
export async function otelSpan(
  context: ReadonlyContext,
  name: string,
  options: SpanOptions,
  handler: () => Promise<InstrumentationServerHandlerResult | InstrumentationHandlerResult>,
  onResult?: (span: Span, result: InstrumentationServerHandlerResult | InstrumentationHandlerResult) => void,
  signal?: AbortSignal,
) {
  const { appContainer } = context.get(appContext);
  const instrumentationService = appContainer.get(TYPES.InstrumentationService);
  return await instrumentationService.startActiveSpan(
    name,
    options,
    async function spanFn(span) {
      try {
        const result = await handler();

        if (onResult) {
          onResult(span, result);
        } else {
          recordError(span, result.error, signal);
        }
      } finally {
        span.end();
      }
    },
    INSTRUMENTATION_SCOPE,
  );
}

/**
 * Records the exception, error status, and `error.type` attribute on a span when a handler fails.
 */
export function recordError(span: Span, error: unknown, signal?: AbortSignal): void {
  const captured = context.active().getValue(APP_ERROR_CAPTURE_KEY) as AppErrorCapture | undefined;

  if (error !== undefined && error !== null && !(error instanceof Response) && !(signal ?? captured?.signal)?.aborted) {
    const applicationError = getAppError(error);
    span.setAttribute('correlationId', getCorrelationId(error) ?? 'N/A');

    if (applicationError) {
      span.recordException({ name: 'AppError', code: applicationError.errorCode });
    } else if (error instanceof Error) {
      span.recordException(error);
    } else {
      span.recordException({ name: 'UnknownError' });
    }

    span.setStatus({ code: SpanStatusCode.ERROR, message: 'internal_error' });
    span.setAttribute(ATTR_ERROR_TYPE, applicationError ? 'AppError' : error instanceof Error ? error.name : 'UnknownError');
  }
}

/**
 * Enriches the top-level request span with response metadata once the handler has completed:
 * status code, matched route (with span rename), normalized URL, route params, and any error.
 *
 * @param span - The active request span to enrich.
 * @param method - The normalized HTTP method, used to rebuild the span name as `{method} {route}`.
 * @param result - The server handler result carrying `statusCode`, `meta`, and `error`.
 */
export function enrichRequestSpan(span: Span, method: string, result: InstrumentationServerHandlerResult, signal?: AbortSignal): void {
  const { error, statusCode, meta } = result;

  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode);

  if (meta?.pattern) {
    span.setAttribute(ATTR_HTTP_ROUTE, meta.pattern);
    span.updateName(`${method} ${meta.pattern}`);
  }

  if (meta?.url) {
    span.setAttribute(ATTR_RR_URL, meta.url.href);
  }

  if (meta?.params) {
    span.setAttributes(paramAttributes(meta.params));
  }

  const captured = context.active().getValue(APP_ERROR_CAPTURE_KEY) as AppErrorCapture | undefined;
  const requestError = error ?? captured?.error;

  if (statusCode >= 400 && statusCode < 500) {
    const correlationId = getCorrelationId(requestError);

    if (correlationId !== undefined && !(signal ?? captured?.signal)?.aborted) {
      span.setAttribute('correlationId', correlationId);
    }
  } else {
    recordError(span, requestError, signal);
  }
}

type AppErrorCapture = { error?: AppError; signal?: AbortSignal };
const APP_ERROR_CAPTURE_KEY = createContextKey('cdcp_app_error_capture');
const instrumentedBuilds = new WeakSet<ServerBuild>();

export async function withAppErrorCapture<T>(handler: () => Promise<T>): Promise<T> {
  return await context.with(context.active().setValue(APP_ERROR_CAPTURE_KEY, {}), handler);
}

async function captureAppError<T>(handler: () => T | Promise<T>, signal: AbortSignal): Promise<T> {
  const captured = context.active().getValue(APP_ERROR_CAPTURE_KEY) as AppErrorCapture | undefined;

  if (captured) {
    captured.signal = signal;
  }

  try {
    return await handler();
  } catch (error) {
    const applicationError = getAppError(error);

    if (applicationError && !signal.aborted) {
      if (captured) {
        captured.error = applicationError;
      }

      const span = trace.getActiveSpan();

      if (span) {
        recordError(span, applicationError, signal);
      }
    }

    throw error;
  }
}

export function instrumentAppErrors(build: ServerBuild): ServerBuild {
  if (instrumentedBuilds.has(build)) {
    return build;
  }

  for (const route of Object.values(build.routes)) {
    if (!route) {
      continue;
    }

    const { loader, action, middleware } = route.module;
    route.module = {
      ...route.module,
      ...(loader ? { loader: Object.assign(async (args: Parameters<typeof loader>[0]) => await captureAppError(() => loader(args), args.request.signal), { hydrate: loader.hydrate }) } : {}),
      ...(action ? { action: async (args) => await captureAppError(() => action(args), args.request.signal) } : {}),
      ...(middleware
        ? {
            middleware: middleware.map((handler) =>
              Object.defineProperty(async (args: Parameters<typeof handler>[0], next: Parameters<typeof handler>[1]) => await captureAppError(async () => await handler(args, next), args.request.signal), 'name', { value: handler.name }),
            ),
          }
        : {}),
    };
  }

  instrumentedBuilds.add(build);
  return build;
}

// -----------------------------------------------------------------------------
// Middleware-counter context (per-request ordering of middleware spans)
// -----------------------------------------------------------------------------

/**
 * Per-request store tracking how many middleware have run for each route id, so that multiple
 * middleware on the same route produce distinct, ordered spans.
 */
type MiddlewareCounterStore = { counters: Record<string, number> };

/**
 * OpenTelemetry context key holding the per-request {@link MiddlewareCounterStore}.
 */
const MIDDLEWARE_COUNTER_KEY = createContextKey('cdcp_react_router_middleware_counter');

/**
 * Runs the given handler with a fresh per-request middleware counter bound into the active
 * OpenTelemetry context, so that {@link nextMiddlewareIndex} can order middleware spans.
 *
 * @param handler - The instrumented request handler to run within the counter context.
 * @returns The handler result.
 */
export async function withMiddlewareCounter<T>(handler: () => Promise<T>): Promise<T> {
  const counterStore: MiddlewareCounterStore = { counters: {} };
  return await context.with(context.active().setValue(MIDDLEWARE_COUNTER_KEY, counterStore), handler);
}

/**
 * Returns the zero-based index of the next middleware to run for the given route within the current
 * request, incrementing the per-request counter held in the active OpenTelemetry context.
 *
 * @param routeId - The route id whose middleware chain is being counted.
 * @returns The zero-based middleware index; `0` when no per-request counter is active.
 */
export function nextMiddlewareIndex(routeId: string): number {
  const store = context.active().getValue(MIDDLEWARE_COUNTER_KEY) as MiddlewareCounterStore | undefined;

  if (!store) {
    return 0;
  }

  const index = store.counters[routeId] ?? 0;
  store.counters[routeId] = index + 1;
  return index;
}

/**
 * Resolves the name of the middleware at the given index for a route from the registered server
 * build, or `undefined` when the middleware function is anonymous.
 *
 * @param routeId - The route id owning the middleware chain.
 * @param index - The zero-based middleware position within that route.
 * @returns The middleware function name, or `undefined` if missing/anonymous.
 */
export function getMiddlewareName(routeId: string, index: number): string | undefined {
  return singleton('serverBuild').routes[routeId]?.module.middleware?.[index]?.name;
}
