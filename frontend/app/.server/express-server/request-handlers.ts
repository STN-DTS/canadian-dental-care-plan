import { ATTR_ERROR_TYPE, ATTR_EXCEPTION_TYPE, ATTR_URL_PATH } from '@opentelemetry/semantic-conventions';
import type { ErrorRequestHandler } from 'express';
import path from 'node:path';

import { createLogger } from '~/.server/logging';

const log = createLogger('express/request-handlers');
const exceptionTypes = new Map<object, string>([
  [Error.prototype, 'Error'],
  [EvalError.prototype, 'EvalError'],
  [RangeError.prototype, 'RangeError'],
  [ReferenceError.prototype, 'ReferenceError'],
  [SyntaxError.prototype, 'SyntaxError'],
  [TypeError.prototype, 'TypeError'],
  [URIError.prototype, 'URIError'],
  [AggregateError.prototype, 'AggregateError'],
]);

function getExceptionType(error: unknown): string | undefined {
  if (!Error.isError(error)) {
    return undefined;
  }

  return exceptionTypes.get(Object.getPrototypeOf(error));
}

export function createGlobalErrorHandler(): ErrorRequestHandler {
  return function globalErrorHandler(error, request, response, next) {
    const exceptionType = getExceptionType(error);
    log.error(error, {
      [ATTR_ERROR_TYPE]: 'express_request_failed',
      ...(exceptionType && { [ATTR_EXCEPTION_TYPE]: exceptionType }),
      [ATTR_URL_PATH]: request.path,
    });

    if (response.headersSent) {
      return next(error);
    }

    const errorFile =
      response.statusCode === 403 //
        ? './assets/403.html'
        : './assets/500.html';

    const errorFilePath = path.join(import.meta.dirname, errorFile);

    response.status(response.statusCode < 400 ? 500 : response.statusCode).sendFile(errorFilePath, (dispatchError: unknown) => {
      if (dispatchError) {
        const dispatchExceptionType = getExceptionType(dispatchError);
        log.error('Could not send request error page', {
          [ATTR_ERROR_TYPE]: 'error_page_dispatch_failed',
          ...(dispatchExceptionType && { [ATTR_EXCEPTION_TYPE]: dispatchExceptionType }),
          [ATTR_URL_PATH]: request.path,
        });
        response.status(500).send('Internal Server Error');
      }
    });
  };
}
