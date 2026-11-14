import type { MiddlewareFunction } from 'react-router';

import { isSpanContextValid, trace } from '@opentelemetry/api';

import { correlationIdContext } from '~/.server/context/correlation-context';
import { ATTR_CDCP_CORRELATION_ID } from '~/.server/logging/log-attributes';
import { generateId } from '~/utils/id-utils';

/**
 * Middleware to handle correlation IDs for incoming requests. It ensures that each request has a correlation ID,
 * either from the active OpenTelemetry trace or a newly generated ID. The correlation ID is added to the context
 * and response headers.
 */
export const correlationMiddleware: MiddlewareFunction<Response> = async ({ context, request }, next) => {
  // Extract the trace ID from the active span if it is valid
  const activeSpan = trace.getActiveSpan();
  const spanContext = activeSpan?.spanContext();
  const validTraceId = spanContext && isSpanContextValid(spanContext) ? spanContext.traceId : undefined;

  const correlationId = validTraceId ?? generateId();
  context.set(correlationIdContext, correlationId);
  activeSpan?.setAttribute(ATTR_CDCP_CORRELATION_ID, correlationId);

  const response = await next();
  response.headers.set('x-correlation-id', correlationId);
  return response;
};
