import { HttpStatusCodes } from '~/constants/http-status-codes';
import type { HttpStatusCode } from '~/constants/http-status-codes';
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

/**
 * Type guard to check if an error is a AppError.
 *
 * Note: this function does not use `instanceof` because the type
 *       information is lost when shipped to the client
 */
export function isAppError(error: unknown): error is AppError {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'AppError';
}
