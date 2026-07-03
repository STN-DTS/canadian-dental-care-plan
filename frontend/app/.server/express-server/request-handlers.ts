import type { ErrorRequestHandler } from 'express';
import path from 'node:path';

import { createLogger } from '~/.server/logging';

const log = createLogger('request-handlers.server.ts');

export function globalErrorHandler(): ErrorRequestHandler {
  return (error, request, response, next) => {
    log.error(error);

    if (response.headersSent) {
      return next(error);
    }

    const errorFile =
      response.statusCode === 403 //
        ? './assets/403.html'
        : './assets/500.html';

    const errorFilePath = path.join(import.meta.dirname, errorFile);

    response.status(response.statusCode).sendFile(errorFilePath, (dispatchError: unknown) => {
      if (dispatchError) {
        log.error(dispatchError);
        response.status(500).send('Internal Server Error');
      }
    });
  };
}
