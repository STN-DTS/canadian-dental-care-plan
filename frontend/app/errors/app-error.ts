import { HttpStatusCodes } from '~/constants/http-status-codes';
import type { HttpStatusCode } from '~/constants/http-status-codes';
import { isErrorCode } from '~/errors/error-codes';
import type { ErrorCode } from '~/errors/error-codes';

export type AppErrorOptions = ErrorOptions & {
  /**
   * The correlation ID associated with this error.
   */
  correlationId?: string;

  /**
   * The HTTP status code associated with this error.
   */
  httpStatusCode?: HttpStatusCode;
};

/**
 * A generic, top-level error that all application errors should extend.
 * Carries an error code, correlation ID, and HTTP status code alongside the standard message, stack, and cause.
 */
export class AppError extends Error {
  public readonly name = 'AppError';

  public readonly errorCode: ErrorCode;
  public readonly correlationId: string;
  public readonly httpStatusCode: HttpStatusCode;

  public constructor(msg: string, errorCode: ErrorCode, opts?: AppErrorOptions) {
    super(msg, { cause: opts?.cause });
    this.errorCode = errorCode;
    this.correlationId = opts?.correlationId ?? '';
    this.httpStatusCode = opts?.httpStatusCode ?? HttpStatusCodes.INTERNAL_SERVER_ERROR;
  }
}

export type AppErrorPayload = {
  name: 'AppError';
  errorCode: ErrorCode;
  correlationId: string;
};

/**
 * Type guard to check if an error is a AppError.
 *
 * Serialized payloads are validated separately from actual Error instances.
 */
export function isAppError(error: unknown): error is AppError {
  return (
    error instanceof Error &&
    error.name === 'AppError' &&
    'errorCode' in error &&
    isErrorCode(error.errorCode) &&
    'correlationId' in error &&
    typeof error.correlationId === 'string' &&
    'httpStatusCode' in error &&
    typeof error.httpStatusCode === 'number' &&
    Number.isInteger(error.httpStatusCode) &&
    error.httpStatusCode >= 400 &&
    error.httpStatusCode <= 599
  );
}

export function isAppErrorPayload(value: unknown): value is AppErrorPayload {
  return typeof value === 'object' && value !== null && 'name' in value && value.name === 'AppError' && 'errorCode' in value && isErrorCode(value.errorCode) && 'correlationId' in value && typeof value.correlationId === 'string';
}
