import { data } from 'react-router';

import { describe, expect, it, vi } from 'vitest';

import { AppError, isAppError, isAppErrorPayload } from '~/errors/app-error';
import { ErrorCodes } from '~/errors/error-codes';
import { getActionAppError, getAppError, getCorrelationId, isUpstreamRateLimitedError, toAppErrorPayload } from '~/errors/error-predicates';
import { randomString } from '~/utils/string-utils';

vi.mock(import('~/utils/string-utils'));

const rateLimitCodes = [
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
] as const;

describe('error extraction', () => {
  it('preserves direct and serialized wrapped AppError IDs', () => {
    const error = new AppError('Synthetic failure', ErrorCodes.DEV_TEST_ERROR, { correlationId: ' AB-123456 ' });
    const serialized = JSON.parse(JSON.stringify(error));
    const wrapped = { status: 500, statusText: 'Internal Server Error', internal: false, data: serialized };
    const thrownData = data(error, { status: 500 });

    const payload = { name: 'AppError', errorCode: ErrorCodes.DEV_TEST_ERROR, correlationId: ' AB-123456 ' };
    expect(getAppError(error)).toEqual(payload);
    expect(getAppError(wrapped)).toEqual(payload);
    expect(getAppError(thrownData)).toEqual(payload);
    expect(getAppError(JSON.parse(JSON.stringify(thrownData)))).toEqual(payload);
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

  it('extracts only public AppErrorPayload fields from inline actionData', () => {
    const raw = {
      appError: {
        name: 'AppError',
        errorCode: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED,
        correlationId: 'AB-123456',
        message: 'synthetic-private-message',
        extra: 'should-be-stripped',
      },
    };

    expect(getActionAppError(raw)).toEqual({
      name: 'AppError',
      errorCode: ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED,
      correlationId: 'AB-123456',
    });

    const appError = new AppError('synthetic-private-message', ErrorCodes.DEV_TEST_ERROR, {
      correlationId: 'CD-999999',
      meta: { secret: 'value' },
    });
    expect(toAppErrorPayload(appError)).toEqual({
      name: 'AppError',
      errorCode: ErrorCodes.DEV_TEST_ERROR,
      correlationId: 'CD-999999',
    });
  });

  it.each([
    undefined,
    null,
    'string',
    { errors: { acknowledgeInfo: ['Required'] } },
    { appError: null },
    { appError: { name: 'Error', errorCode: ErrorCodes.DEV_TEST_ERROR, correlationId: '' } },
    { appError: { name: 'AppError', errorCode: 'UNKNOWN-0001', correlationId: '' } },
    { appError: { name: 'AppError', errorCode: ErrorCodes.DEV_TEST_ERROR } },
  ])('returns undefined from getActionAppError for non-matching shapes: %j', (actionData) => {
    expect(getActionAppError(actionData)).toBeUndefined();
  });
});

describe('AppError', () => {
  it('should create a AppError with default values', () => {
    const error = new AppError('Something went wrong', ErrorCodes.DEV_TEST_ERROR);
    expect(error).toBeInstanceOf(Error);
    expect(error.errorCode).toEqual('DEV-TEST-0001');
    expect(error.correlationId).toEqual('');
    expect(error.message).toEqual('Something went wrong');
    expect(error.stack).toBeDefined();
    expect(getCorrelationId(JSON.parse(JSON.stringify(error)))).toBeUndefined();
    expect(randomString).not.toHaveBeenCalled();
  });

  it('should create a AppError with custom values', () => {
    const message = 'Something went wrong';
    const correlationId = 'ABC-123456';

    const error = new AppError(message, ErrorCodes.DEV_TEST_ERROR, { correlationId });

    expect(error.errorCode).toEqual(ErrorCodes.DEV_TEST_ERROR);
    expect(error.correlationId).toEqual(correlationId);
    expect(error.message).toEqual(message);
    expect(error.stack).toBeDefined();
    expect(getCorrelationId(JSON.parse(JSON.stringify(error)))).toEqual(correlationId);
    expect(randomString).not.toHaveBeenCalled();
  });
});

describe('isAppError', () => {
  it('should return true for a AppError', () => {
    expect(isAppError(new AppError('Something went wrong', ErrorCodes.DEV_TEST_ERROR))).toEqual(true);
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

  it('rejects inactive codes and malformed serialized payloads', () => {
    expect(isAppError(Object.assign(new Error('legacy'), { name: 'AppError', errorCode: 'XAPI-0002', correlationId: '', httpStatusCode: 500 }))).toBe(false);
    expect(isAppErrorPayload({ name: 'AppError', errorCode: 'XAPI-0002', correlationId: '' })).toBe(false);
    expect(isAppErrorPayload({ name: 'AppError', errorCode: ErrorCodes.DEV_TEST_ERROR, correlationId: '' })).toBe(true);
  });

  it.each(rateLimitCodes)('recognizes upstream rate-limit code %s', (errorCode) => {
    expect(isUpstreamRateLimitedError(new AppError('Rate limited', errorCode))).toBe(true);
  });

  it('rejects invalid and non-rate-limit errors', () => {
    expect(isUpstreamRateLimitedError({ name: 'AppError', errorCode: ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED })).toBe(false);
    expect(isUpstreamRateLimitedError(new AppError('Local refusal', ErrorCodes.APP_SUBM_PUBLIC_APPLICATION_KILLSWITCH_ENGAGED))).toBe(false);
    expect(isUpstreamRateLimitedError(new AppError('Upstream failure', ErrorCodes.API_BENEFIT_APPLICATION_CREATE_FAILED))).toBe(false);

    const expectedRateLimitCodes = new Set<string>(rateLimitCodes);

    for (const errorCode of Object.values(ErrorCodes)) {
      expect(isUpstreamRateLimitedError(new AppError('Failure', errorCode))).toBe(expectedRateLimitCodes.has(errorCode));
    }
  });
});
