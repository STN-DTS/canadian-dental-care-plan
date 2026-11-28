import { data } from 'react-router';

import { trace } from '@opentelemetry/api';
import { ATTR_ERROR_TYPE, ATTR_HTTP_RESPONSE_STATUS_CODE } from '@opentelemetry/semantic-conventions';

import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_CORRELATION_ID, ATTR_CDCP_ERROR_CODE } from '~/.server/logging/log-attributes';
import { recordError } from '~/.server/utils/otel-instrumentation-utils';
import { HttpStatusCodes } from '~/constants/http-status-codes';
import { isAppError } from '~/errors/app-error';
import type { ActionAppError } from '~/errors/error-predicates';
import { toAppErrorPayload } from '~/errors/error-predicates';

type ActionAppErrorData = ReturnType<typeof data<ActionAppError>>;

/**
 * Wraps a React Router route `action` so thrown `AppError` instances are returned
 * inline as `data({ appError }, { status: error.httpStatusCode })` instead of
 * bubbling to an `ErrorBoundary` and unmounting the form.
 *
 * Non-`AppError` throws (including redirect `Response`s and unexpected runtime
 * crashes) are re-thrown untouched. Because returning `data()` prevents React
 * Router's instrumentation and `entry.server/handleError` from seeing a thrown
 * error, this wrapper records the exception on the active OpenTelemetry span
 * and logs it using allowlisted attributes.
 */
export function withActionAppError<TArgs extends unknown[], TResult>(actionFn: (...args: TArgs) => TResult | Promise<TResult>): (...args: TArgs) => Promise<TResult | ActionAppErrorData> {
  return async (...args) => {
    try {
      return await actionFn(...args);
    } catch (error: unknown) {
      if (!isAppError(error)) {
        throw error;
      }

      const span = trace.getActiveSpan();

      if (span) {
        recordError(span, error);

        if (error.correlationId) {
          span.setAttribute(ATTR_CDCP_CORRELATION_ID, error.correlationId);
        }
      }

      const log = createLogger('action-app-error');
      const logAttributes = {
        [ATTR_ERROR_TYPE]: error.name,
        [ATTR_CDCP_ERROR_CODE]: error.errorCode,
        [ATTR_HTTP_RESPONSE_STATUS_CODE]: error.httpStatusCode,
        ...(error.correlationId ? { [ATTR_CDCP_CORRELATION_ID]: error.correlationId } : {}),
      };

      if (error.httpStatusCode >= HttpStatusCodes.INTERNAL_SERVER_ERROR) {
        log.error(error, logAttributes);
      } else {
        log.warn(error, logAttributes);
      }

      return data<ActionAppError>({ appError: toAppErrorPayload(error) }, { status: error.httpStatusCode });
    }
  };
}
