import { expect, test } from 'vitest';

import { operationalErrorCode, operationalErrorType } from '~/instrumentation/operational-error-type';

test.each([
  ['ECONNREFUSED', 'Error'],
  ['ETIMEDOUT', 'Error'],
  ['synthetic-secret-code', 'Error'],
])('classifies code %s without exporting the error', (code, expected) => {
  expect(operationalErrorType(Object.assign(new Error('synthetic-secret-message'), { code }))).toBe(expected);
});

test('rejects arbitrary objects and does not invoke error code getters', () => {
  expect(operationalErrorType({ code: 'ECONNREFUSED' })).toBe('_OTHER');
  const error = Object.defineProperty(new Error('synthetic-secret'), 'code', {
    get() {
      throw new Error('Must not execute getter');
    },
  });
  expect(operationalErrorType(error)).toBe('Error');
});

test.each([
  [new TypeError('synthetic-secret'), 'TypeError'],
  [new RangeError('synthetic-secret'), 'RangeError'],
  [new SyntaxError('synthetic-secret'), 'SyntaxError'],
  [new Error('synthetic-secret'), 'Error'],
])('reports native error constructor names', (error, expected) => {
  expect(operationalErrorType(error)).toBe(expected);
});

test('does not trust arbitrary error names or constructor names', () => {
  const error = Object.assign(new Error('synthetic-secret'), { name: 'TypeError', constructor: { name: 'synthetic-secret-class' } });

  expect(operationalErrorType(error)).toBe('Error');
  expect(operationalErrorType(Object.assign(new TypeError('synthetic-secret'), { name: 'synthetic-secret-class' }))).toBe('TypeError');
});

test('reports custom subclass names even when the instance name remains Error', () => {
  class CustomOperationalError extends Error {}

  expect(operationalErrorType(new CustomOperationalError('synthetic-secret'))).toBe('CustomOperationalError');
});

test.each([undefined, null, 'synthetic-secret', 42, { name: 'Error' }])('uses _OTHER for non-errors', (value) => {
  expect(operationalErrorType(value)).toBe('_OTHER');
});

test('does not execute prototype constructor getters or export unsupported class names', () => {
  const error = new Error('synthetic-secret');
  Object.setPrototypeOf(
    error,
    Object.defineProperty({}, 'constructor', {
      get() {
        throw new Error('Must not execute getter');
      },
    }),
  );
  expect(operationalErrorType(error)).toBe('Error');

  class CustomError extends Error {}
  Object.defineProperty(CustomError, 'name', { value: 'synthetic-person@example.test' });
  expect(operationalErrorType(new CustomError())).toBe('Error');
});

test('does not invoke traps on proxied prototypes or constructors', () => {
  const prototype = new Proxy(
    {},
    {
      getOwnPropertyDescriptor() {
        throw new Error('Must not execute trap');
      },
    },
  );
  const error = new Error('synthetic-secret');
  Object.setPrototypeOf(error, prototype);
  expect(operationalErrorType(error)).toBe('Error');

  const constructor = new Proxy(Error, {
    getOwnPropertyDescriptor() {
      throw new Error('Must not execute trap');
    },
  });
  Object.setPrototypeOf(error, { constructor });
  expect(operationalErrorType(error)).toBe('Error');
});

test('only returns allowlisted system codes from genuine errors', () => {
  expect(operationalErrorCode(Object.assign(new Error('synthetic-secret'), { code: 'ECONNREFUSED' }))).toBe('ECONNREFUSED');
  expect(operationalErrorCode(Object.assign(new Error('synthetic-secret'), { code: 'ETIMEDOUT' }))).toBe('ETIMEDOUT');
  expect(operationalErrorCode(Object.assign(new Error('synthetic-secret'), { code: 'synthetic-token-canary' }))).toBeUndefined();
  expect(operationalErrorCode({ code: 'ECONNREFUSED' })).toBeUndefined();
  expect(
    operationalErrorCode(
      Object.defineProperty(new Error(), 'code', {
        get() {
          throw new Error('Must not execute getter');
        },
      }),
    ),
  ).toBeUndefined();
});
