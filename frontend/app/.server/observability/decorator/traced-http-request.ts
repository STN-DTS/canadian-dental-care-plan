import { SpanKind, SpanStatusCode, context, propagation, trace } from '@opentelemetry/api';
import { suppressTracing } from '@opentelemetry/core';
import {
  ATTR_ERROR_TYPE,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESPONSE_STATUS_CODE,
  HTTP_REQUEST_METHOD_VALUE_CONNECT,
  HTTP_REQUEST_METHOD_VALUE_DELETE,
  HTTP_REQUEST_METHOD_VALUE_GET,
  HTTP_REQUEST_METHOD_VALUE_HEAD,
  HTTP_REQUEST_METHOD_VALUE_OPTIONS,
  HTTP_REQUEST_METHOD_VALUE_OTHER,
  HTTP_REQUEST_METHOD_VALUE_PATCH,
  HTTP_REQUEST_METHOD_VALUE_POST,
  HTTP_REQUEST_METHOD_VALUE_PUT,
  HTTP_REQUEST_METHOD_VALUE_TRACE,
} from '@opentelemetry/semantic-conventions';
import { Headers, Request } from 'undici';

import type { HttpClient } from '~/.server/http/http-client';
import { operationalErrorCode } from '~/instrumentation/operational-error-type';

type HttpRequestMethod = HttpClient['instrumentedFetch'];

const knownMethods = new Set<string>([
  HTTP_REQUEST_METHOD_VALUE_CONNECT,
  HTTP_REQUEST_METHOD_VALUE_DELETE,
  HTTP_REQUEST_METHOD_VALUE_GET,
  HTTP_REQUEST_METHOD_VALUE_HEAD,
  HTTP_REQUEST_METHOD_VALUE_OPTIONS,
  HTTP_REQUEST_METHOD_VALUE_PATCH,
  HTTP_REQUEST_METHOD_VALUE_POST,
  HTTP_REQUEST_METHOD_VALUE_PUT,
  HTTP_REQUEST_METHOD_VALUE_TRACE,
]);

/**
 * Records a bounded HTTP dependency span without URLs, bodies or raw exceptions.
 * The operation argument must be a fixed code-defined name, not request data.
 */
export function TracedHttpRequest() {
  return (_target: object, propertyKey: string | symbol, propertyDescriptor: TypedPropertyDescriptor<HttpRequestMethod>): void => {
    const originalFunction = propertyDescriptor.value;

    if (typeof originalFunction !== 'function') {
      throw new Error(`The @TracedHttpRequest decorator can only be used on methods, but ${String(propertyKey)} is not a method.`);
    }

    propertyDescriptor.value = new Proxy(originalFunction, {
      apply: async (method, thisArg, args: Parameters<HttpRequestMethod>) => {
        const [operation, input, options] = args;
        const requestMethod = (options?.method ?? (input instanceof Request ? input.method : HTTP_REQUEST_METHOD_VALUE_GET)).toUpperCase();
        const attributes = { [ATTR_HTTP_REQUEST_METHOD]: knownMethods.has(requestMethod) ? requestMethod : HTTP_REQUEST_METHOD_VALUE_OTHER };

        return await trace.getTracer('default').startActiveSpan(operation, { kind: SpanKind.CLIENT, attributes }, async (span) => {
          try {
            // Suppression also disables automatic transport context injection.
            const propagationHeaders: Record<string, string> = {};
            propagation.inject(context.active(), propagationHeaders);
            const entries = Object.entries(propagationHeaders);
            let requestOptions = options;

            if (entries.length > 0) {
              const headers = new Headers(options?.headers ?? (input instanceof Request ? input.headers : undefined));

              for (const [name, value] of entries) {
                headers.set(name, value);
              }

              requestOptions = { ...options, headers };
            }

            const response = await context.with(suppressTracing(context.active()), async () => await method.call(thisArg, operation, input, requestOptions));
            span.setAttribute(ATTR_HTTP_RESPONSE_STATUS_CODE, response.status);

            if (response.status >= 400) {
              span.setAttribute(ATTR_ERROR_TYPE, String(response.status));
              span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${response.status}` });
            }

            return response;
          } catch (error) {
            const cause: unknown = Error.isError(error) ? Object.getOwnPropertyDescriptor(error, 'cause')?.value : undefined;
            span.setAttribute(ATTR_ERROR_TYPE, operationalErrorCode(error) ?? operationalErrorCode(cause) ?? 'http_request_failed');
            span.setStatus({ code: SpanStatusCode.ERROR, message: 'HTTP request did not complete.' });
            throw error;
          } finally {
            span.end();
          }
        });
      },
    });
  };
}
