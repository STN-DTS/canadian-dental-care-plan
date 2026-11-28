import { isRouteErrorResponse } from 'react-router';

import { isAppError, isAppErrorPayload } from '~/errors/app-error';
import type { AppError, AppErrorPayload } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import type { ErrorCode } from '~/errors/error-codes';

const upstreamRateLimitCodes: ReadonlySet<ErrorCode> = new Set([
  ErrorCodes.API_APPLICANT_FIND_BY_BASIC_INFO_RATE_LIMITED,
  ErrorCodes.API_APPLICANT_FIND_BY_SIN_RATE_LIMITED,
  ErrorCodes.API_BENEFIT_APPLICATION_CREATE_RATE_LIMITED,
  ErrorCodes.API_BENEFIT_RENEWAL_CREATE_RATE_LIMITED,
  ErrorCodes.API_CLIENT_APPLICATION_FIND_BY_BASIC_INFO_RATE_LIMITED,
  ErrorCodes.API_CLIENT_APPLICATION_FIND_BY_SIN_RATE_LIMITED,
  ErrorCodes.API_LTR_FIND_RATE_LIMITED,
  ErrorCodes.API_LTR_PDF_GET_RATE_LIMITED,
  ErrorCodes.API_STATUS_FIND_BY_BASIC_INFO_RATE_LIMITED,
  ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED,
  ErrorCodes.API_VERIFY_CODE_EMAIL_SEND_RATE_LIMITED,
  ErrorCodes.API_VERIFY_CODE_HEALTH_RATE_LIMITED,
]);

export type ActionAppError = Readonly<{
  appError: AppErrorPayload;
}>;

export function getAppError(error: unknown): AppErrorPayload | undefined {
  if (isAppError(error)) {
    return toAppErrorPayload(error);
  }

  if (isRouteErrorResponse(error) || (typeof error === 'object' && error !== null && 'type' in error && error.type === 'DataWithResponseInit' && 'data' in error && 'init' in error)) {
    if (isAppError(error.data)) {
      return toAppErrorPayload(error.data);
    }

    if (isAppErrorPayload(error.data)) {
      return toAppErrorPayload(error.data);
    }
  }

  if (isAppErrorPayload(error)) {
    return toAppErrorPayload(error);
  }
}

export function getActionAppError(actionData: unknown): AppErrorPayload | undefined {
  if (typeof actionData === 'object' && actionData !== null && 'appError' in actionData && isAppErrorPayload(actionData.appError)) {
    return toAppErrorPayload(actionData.appError);
  }

  return undefined;
}

export function toAppErrorPayload(error: AppError | AppErrorPayload): AppErrorPayload {
  return {
    name: error.name,
    errorCode: error.errorCode,
    correlationId: error.correlationId,
  };
}

export function isUpstreamRateLimitedError(error: unknown): error is AppError {
  return isAppError(error) && upstreamRateLimitCodes.has(error.errorCode);
}

export function getCorrelationId(error: unknown): string | undefined {
  const correlationId = getAppError(error)?.correlationId;
  return typeof correlationId === 'string' && correlationId.trim() !== '' ? correlationId : undefined;
}
