/**
 * @file
 * OpenTelemetry server instrumentation for React Router's instrumentation API.
 *
 * Wires React Router's request/route instrumentation hooks to OpenTelemetry spans: a top-level
 * `SERVER` span per request and `INTERNAL` child spans for each route middleware, loader, and
 * action. Attribute building and span lifecycle live in `otel-instrumentation.utils`.
 *
 * This is not a copy of any single reference implementation; it draws on the approaches in the
 * `@see` links below and adapts them to this app's spans and attributes.
 *
 * @see https://reactrouter.com/how-to/instrumentation#opentelemetry-integration
 * @see https://github.com/open-telemetry/opentelemetry-js/tree/cf7c419ccacfd7340306bc81d5e142ef73e18f9d/experimental/packages/opentelemetry-instrumentation-http
 * @see https://github.com/getsentry/sentry-javascript/blob/0ea8a5168b9af98547ff3a812ddc8756288b0848/packages/react-router/src/server/createServerInstrumentation.ts
 */
import type { InstrumentationServerHandlerResult, ServerInstrumentation } from 'react-router';

import { SpanKind } from '@opentelemetry/api';
import type { SpanOptions } from '@opentelemetry/api';

import { createLogger } from '~/.server/logging';
import {
  ATTR_RR_MIDDLEWARE_INDEX,
  ATTR_RR_MIDDLEWARE_NAME,
  buildRequestAttributes,
  buildRouteAttributes,
  enrichRequestSpan,
  getMiddlewareName,
  nextMiddlewareIndex,
  normalizeMethod,
  otelSpan,
  withMiddlewareCounter,
} from '~/.server/utils/otel-instrumentation-utils';

/**
 * Creates an OpenTelemetry server instrumentation for React Router's instrumentation API.
 *
 * Emits two levels of spans:
 *
 *   - a top-level `SERVER` span per request (named `{method} {path}`, later renamed to
 *     `{method} {route}` once the route is matched), and
 *   - `INTERNAL` child spans per route middleware, loader, and action (named `{phase} {pattern}`).
 *
 * Middleware spans additionally carry their execution order and name, tracked via a per-request
 * counter established by {@link withMiddlewareCounter}.
 *
 * @returns The React Router server instrumentation to register with the runtime.
 */
export function createOtelInstrumentation(): ServerInstrumentation {
  const log = createLogger('observability/otel-instrumentation');
  log.info('Creating OpenTelemetry instrumentation for React Router');

  return {
    handler({ instrument }) {
      instrument({
        // Top-level SERVER span for the whole request. Named `{method} {path}` up front, then
        // renamed to `{method} {route}` by enrichRequestSpan once the matched route is known.
        async request(handler, { context, request }) {
          if (!context) {
            throw new Error('React Router "request" instrumentation is missing its context; cannot resolve the app container for OpenTelemetry spans');
          }

          // Establish a per-request middleware counter so nested middleware spans can be ordered.
          const instrumentedHandler = async () => await withMiddlewareCounter(handler);

          const method = normalizeMethod(request.method);
          const pathname = new URL(request.url).pathname;
          const spanOptions: SpanOptions = { kind: SpanKind.SERVER, attributes: buildRequestAttributes(request) };
          await otelSpan(context, `${request.method} ${pathname}`, spanOptions, instrumentedHandler, (span, result) => {
            enrichRequestSpan(span, method, result as InstrumentationServerHandlerResult);
          });
        },
      });
    },
    route({ instrument, id }) {
      instrument({
        // INTERNAL span per route middleware, tagged with its execution order and function name.
        async middleware(handler, { context, pattern, url, request, params }) {
          const index = nextMiddlewareIndex(id);
          const middlewareName = getMiddlewareName(id, index);
          const name = `middleware ${middlewareName ?? id}`;
          const spanOptions: SpanOptions = {
            kind: SpanKind.INTERNAL,
            attributes: {
              ...buildRouteAttributes(id, pattern, url, request, params),
              [ATTR_RR_MIDDLEWARE_INDEX]: index,
              ...(name ? { [ATTR_RR_MIDDLEWARE_NAME]: name } : {}),
            },
          };
          await otelSpan(context, `middleware ${pattern}`, spanOptions, handler);
        },
        // INTERNAL span per route loader.
        async loader(handler, { context, pattern, url, request, params }) {
          const spanOptions: SpanOptions = {
            kind: SpanKind.INTERNAL,
            attributes: buildRouteAttributes(id, pattern, url, request, params),
          };
          await otelSpan(context, `loader ${pattern}`, spanOptions, handler);
        },
        // INTERNAL span per route action.
        async action(handler, { context, pattern, url, request, params }) {
          const spanOptions: SpanOptions = {
            kind: SpanKind.INTERNAL,
            attributes: buildRouteAttributes(id, pattern, url, request, params),
          };
          await otelSpan(context, `action ${pattern}`, spanOptions, handler);
        },
      });
    },
  };
}
