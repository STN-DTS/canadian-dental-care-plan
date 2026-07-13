/**
 * @file
 * OpenTelemetry helpers for the React Router server instrumentation.
 *
 * Turns React Router request/route/middleware instrumentation callbacks into OpenTelemetry
 * spans that follow the HTTP semantic conventions (`http.*`, `url.*`, `server.*`), plus a few
 * custom `react_router.*` attributes (route id, matched URL, route params, middleware order/name).
 *
 * @see https://opentelemetry.io/docs/specs/semconv/http/http-spans/
 */
import type { InstrumentationHandlerResult, InstrumentationServerHandlerResult, Params } from 'react-router';

import { SpanStatusCode, context, createContextKey } from '@opentelemetry/api';
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

import { appContainer } from '~/.server/app.container';
import { TYPES } from '~/.server/constants';
import { singleton } from '~/.server/utils/instance-registry';

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
 * Custom (non-semantic-convention) span attribute keys used by this instrumentation.
 */
export const ATTR_RR_ROUTE_ID = 'react_router.route.id';
export const ATTR_RR_URL = 'react_router.url';
export const ATTR_RR_PARAM_PREFIX = 'react_router.params.';
export const ATTR_RR_MIDDLEWARE_INDEX = 'react_router.middleware.index';
export const ATTR_RR_MIDDLEWARE_NAME = 'react_router.middleware.name';

/**
 * Per-request store tracking how many middleware have run for each route id, so that multiple
 * middleware on the same route produce distinct, ordered spans.
 */
export type MiddlewareCounterStore = { counters: Record<string, number> };

/**
 * OpenTelemetry context key holding the per-request {@link MiddlewareCounterStore}.
 */
export const MIDDLEWARE_COUNTER_KEY = createContextKey('cdcp_react_router_middleware_counter');

/**
 * Wraps an instrumented handler in an active OpenTelemetry span.
 *
 * @param name - The initial span name.
 * @param options - Span options (attributes, kind).
 * @param handler - The instrumented handler to execute within the span.
 * @param onResult - Optional callback to enrich the span from the handler result; when omitted, errors are recorded by default.
 */
export async function otelSpan(
  name: string,
  options: SpanOptions,
  handler: () => Promise<InstrumentationServerHandlerResult | InstrumentationHandlerResult>,
  onResult?: (span: Span, result: InstrumentationServerHandlerResult | InstrumentationHandlerResult) => void,
) {
  const instrumentationService = appContainer().get(TYPES.InstrumentationService);
  return await instrumentationService.startActiveSpan(
    name,
    options,
    async function spanFn(span) {
      const result = await handler();

      if (onResult) {
        onResult(span, result);
      } else {
        recordError(span, result.error);
      }

      span.end();
    },
    INSTRUMENTATION_SCOPE,
  );
}

/**
 * Records the exception, error status, and `error.type` attribute on a span when a handler fails.
 */
export function recordError(span: Span, error: Error | undefined): void {
  if (error) {
    span.recordException(error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: 'internal_error' });
    span.setAttribute(ATTR_ERROR_TYPE, error.name);
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
export function enrichRequestSpan(span: Span, method: string, result: InstrumentationServerHandlerResult): void {
  const { error, statusCode, meta } = result;

  span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, statusCode);

  if (meta?.pattern) {
    span.setAttribute(ATTR_HTTP_ROUTE, meta.pattern);
    span.updateName(`${method} ${meta.pattern}`);
  }

  if (meta?.url) {
    span.setAttribute(ATTR_RR_URL, meta.url.toString());
  }

  if (meta?.params) {
    span.setAttributes(paramAttributes(meta.params));
  }

  recordError(span, error);
}

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

/**
 * Derives the remote client address from proxy headers (`forwarded`, then `x-forwarded-for`).
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
