import { data } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { AppError, isAppError } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { getAppError, getCorrelationId } from '~/errors/error-predicates';
import { randomString } from '~/utils/string-utils';

vi.mock(import('~/utils/string-utils'));

describe('error extraction', () => {
  it('preserves direct and serialized wrapped AppError IDs', () => {
    const error = new AppError('Synthetic failure', ErrorCodes.TEST_ERROR_CODE, { correlationId: ' AB-123456 ' });
    const serialized = JSON.parse(JSON.stringify(error));
    const wrapped = { status: 500, statusText: 'Internal Server Error', internal: false, data: serialized };
    const thrownData = data(error, { status: 500 });

    expect(getAppError(error)).toBe(error);
    expect(getAppError(wrapped)).toEqual(serialized);
    expect(getAppError(thrownData)).toBe(error);
    expect(getAppError(JSON.parse(JSON.stringify(thrownData)))).toEqual(serialized);
    expect(getCorrelationId(error)).toBe(' AB-123456 ');
    expect(getCorrelationId(wrapped)).toBe(error.correlationId);
    expect(getCorrelationId(thrownData)).toBe(error.correlationId);
    expect(randomString).not.toHaveBeenCalled();
  });

  it.each([undefined, null, '', '   ', 123, {}, []])('ignores an invalid or missing ID: %j', (correlationId) => {
    const error = { name: 'AppError', correlationId };
    expect(getCorrelationId(error)).toBeUndefined();
    expect(getCorrelationId({ status: 500, statusText: '', internal: false, data: error })).toBeUndefined();
    expect(getCorrelationId(data(error, { status: 500 }))).toBeUndefined();
  });

  it.each([
    undefined,
    null,
    new Error('Synthetic failure'),
    { correlationId: 'AB-123456' },
    { data: { name: 'AppError', correlationId: 'AB-123456' } },
    { type: 'DataWithResponseInit', data: { name: 'AppError', correlationId: 'AB-123456' } },
    { type: 'OtherWrapper', init: null, data: { name: 'AppError', correlationId: 'AB-123456' } },
    data(new Error('Synthetic failure'), { status: 500 }),
    new Response(null, { status: 400 }),
  ])('ignores non-AppError shapes: %j', (error) => {
    expect(getAppError(error)).toBeUndefined();
    expect(getCorrelationId(error)).toBeUndefined();
  });
});

describe('AppError', () => {
  it('should create a AppError with default values', () => {
    vi.mocked(randomString).mockReturnValueOnce('AB');
    vi.mocked(randomString).mockReturnValueOnce('123456');

    const error = new AppError('Something went wrong');
    expect(error.errorCode).toEqual('UNC-0000');
    expect(error.correlationId).toEqual('AB-123456');
    expect(error.msg).toEqual('Something went wrong');
    expect(error.stack).toBeDefined();
    expect(getCorrelationId(JSON.parse(JSON.stringify(error)))).toEqual(error.correlationId);
    expect(randomString).toHaveBeenCalledTimes(2);
  });

  it('should create a AppError with custom values', () => {
    const message = 'Something went wrong';
    const correlationId = 'ABC-123456';

    const error = new AppError(message, ErrorCodes.TEST_ERROR_CODE, { correlationId });

    expect(error.errorCode).toEqual(ErrorCodes.TEST_ERROR_CODE);
    expect(error.correlationId).toEqual(correlationId);
    expect(error.msg).toEqual(message);
    expect(error.stack).toBeDefined();
    expect(getCorrelationId(JSON.parse(JSON.stringify(error)))).toEqual(correlationId);
    expect(randomString).not.toHaveBeenCalled();
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
