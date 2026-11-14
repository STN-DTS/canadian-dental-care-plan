import { getCorrelationId } from '~/.server/context/correlation-context';
import { AppError } from '~/errors/app-error';
import type { AppErrorOptions } from '~/errors/app-error';
import type { ErrorCode } from '~/errors/error-codes';
import { ErrorCodes } from '~/errors/error-codes';

/**
 * Creates an application error, using the current correlation ID unless one is provided.
 *
 * @param msg - Error message.
 * @param errorCode - Error code; defaults to `UNCAUGHT_ERROR`.
 * @param opts - Additional error options, including an optional correlation ID override.
 * @returns The application error.
 */
export function createAppError(msg: string, errorCode: ErrorCode = ErrorCodes.UNCAUGHT_ERROR, opts?: AppErrorOptions): AppError {
  return new AppError(msg, errorCode, {
    ...opts,
    correlationId: opts?.correlationId ?? getCorrelationId(),
  });
}

/**
 * Creates and throws an application error with the current or provided correlation ID.
 *
 * @param msg - Error message.
 * @param errorCode - Error code; defaults to `UNCAUGHT_ERROR`.
 * @param opts - Additional error options, including an optional correlation ID override.
 * @throws {AppError} Always throws the created application error.
 */
export function throwAppError(msg: string, errorCode: ErrorCode = ErrorCodes.UNCAUGHT_ERROR, opts?: AppErrorOptions): never {
  throw createAppError(msg, errorCode, opts);
}
