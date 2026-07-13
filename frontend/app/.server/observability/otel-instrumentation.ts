/**
 * This file provides an OpenTelemetry instrumentation for React Router's instrumentation API.
 *
 * References:
 *
 *   - https://reactrouter.com/how-to/instrumentation#opentelemetry-integration
 *   - https://github.com/open-telemetry/opentelemetry-js/tree/cf7c419ccacfd7340306bc81d5e142ef73e18f9d/experimental/packages/opentelemetry-instrumentation-http
 *   - https://github.com/getsentry/sentry-javascript/blob/0ea8a5168b9af98547ff3a812ddc8756288b0848/packages/react-router/src/server/createServerInstrumentation.ts
 */
import type { InstrumentationServerHandlerResult, ServerInstrumentation } from 'react-router';

import { SpanKind, context } from '@opentelemetry/api';
import type { SpanOptions } from '@opentelemetry/api';

import { createLogger } from '~/.server/logging';
import {
  ATTR_RR_MIDDLEWARE_INDEX,
  ATTR_RR_MIDDLEWARE_NAME,
  MIDDLEWARE_COUNTER_KEY,
  buildRequestAttributes,
  buildRouteAttributes,
  enrichRequestSpan,
  getMiddlewareName,
  nextMiddlewareIndex,
  normalizeMethod,
  otelSpan,
} from '~/.server/utils/otel-instrumentation.utils';
import type { MiddlewareCounterStore } from '~/.server/utils/otel-instrumentation.utils';

/**
 * Creates an OpenTelemetry server instrumentation for React Router's instrumentation API.
 */
export function createOtelInstrumentation(): ServerInstrumentation {
  const log = createLogger('observability/otel-instrumentation/createOtelInstrumentation');
  log.info('Creating OpenTelemetry instrumentation for React Router');
  return {
    handler({ instrument }) {
      instrument({
        // request instrumentation
        async request(handler, { request }) {
          const method = normalizeMethod(request.method);
          const pathname = new URL(request.url).pathname;

          // Establish a per-request middleware counter so nested middleware spans can be ordered.
          const counterStore: MiddlewareCounterStore = { counters: {} };
          const instrumentedHandler = async () => {
            return await context.with(context.active().setValue(MIDDLEWARE_COUNTER_KEY, counterStore), handler);
          };

          const spanOptions: SpanOptions = { kind: SpanKind.SERVER, attributes: buildRequestAttributes(request) };
          await otelSpan(`${request.method} ${pathname}`, spanOptions, instrumentedHandler, (span, result) => {
            enrichRequestSpan(span, method, result as InstrumentationServerHandlerResult);
          });
        },
      });
    },
    route({ instrument, id }) {
      instrument({
        // route middleware instrumentation
        async middleware(handler, { pattern, url, request, params }) {
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
          await otelSpan(`middleware ${pattern}`, spanOptions, handler);
        },
        // route loader instrumentation
        async loader(handler, { pattern, url, request, params }) {
          const spanOptions: SpanOptions = {
            kind: SpanKind.INTERNAL,
            attributes: buildRouteAttributes(id, pattern, url, request, params),
          };
          await otelSpan(`loader ${pattern}`, spanOptions, handler);
        },
        // route action instrumentation
        async action(handler, { pattern, url, request, params }) {
          const spanOptions: SpanOptions = {
            kind: SpanKind.INTERNAL,
            attributes: buildRouteAttributes(id, pattern, url, request, params),
          };
          await otelSpan(`action ${pattern}`, spanOptions, handler);
        },
      });
    },
  };
}
