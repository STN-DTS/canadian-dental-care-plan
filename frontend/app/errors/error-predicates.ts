import { isRouteErrorResponse } from 'react-router';

import { isAppError } from '~/errors/app-error';
import type { AppError } from '~/errors/app-error';

export function getAppError(error: unknown): AppError | undefined {
  if (isAppError(error)) {
    return error;
  }

  if (isRouteErrorResponse(error) && isAppError(error.data)) {
    return error.data;
  }
}

export function getCorrelationId(error: unknown): string | undefined {
  const correlationId = getAppError(error)?.correlationId;
  return typeof correlationId === 'string' && correlationId.trim() !== '' ? correlationId : undefined;
}
