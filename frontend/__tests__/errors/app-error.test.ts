import { describe, expect, it, vi } from 'vitest';

import { AppError, isAppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { randomString } from '~/utils/string-utils';

vi.mock(import('~/utils/string-utils'));

describe('AppError', () => {
  it('should create a AppError with default values', () => {
    vi.mocked(randomString).mockReturnValueOnce('AB');
    vi.mocked(randomString).mockReturnValueOnce('123456');

    const error = new AppError('Something went wrong');
    expect(error.errorCode).toEqual('UNC-0000');
    expect(error.correlationId).toEqual('AB-123456');
    expect(error.msg).toEqual('Something went wrong');
    expect(error.stack).toBeDefined();
  });

  it('should create a AppError with custom values', () => {
    const message = 'Something went wrong';
    const correlationId = 'ABC-123456';

    const error = new AppError(message, ErrorCodes.TEST_ERROR_CODE, { correlationId });

    expect(error.errorCode).toEqual(ErrorCodes.TEST_ERROR_CODE);
    expect(error.correlationId).toEqual(correlationId);
    expect(error.msg).toEqual(message);
    expect(error.stack).toBeDefined();
  });
});

describe('isAppError', () => {
  it('should return true for a AppError', () => {
    vi.mocked(randomString).mockReturnValueOnce('AB');
    vi.mocked(randomString).mockReturnValueOnce('123456');

    expect(isAppError(new AppError('Something went wrong'))).toEqual(true);
  });

  it('should return false for a regular Error', () => {
    expect(isAppError(new Error('Something went wrong'))).toEqual(false);
  });

  it('should return false for a non-object', () => {
    expect(isAppError(null)).toEqual(false);
    expect(isAppError(undefined)).toEqual(false);
    expect(isAppError('string')).toEqual(false);
    expect(isAppError(123)).toEqual(false);
  });

  it('should return false for an object without a name property', () => {
    expect(isAppError({})).toEqual(false);
  });

  it('should return false for an object with a different name property', () => {
    expect(isAppError({ name: 'OtherError' })).toEqual(false);
  });
});
