import { Redacted } from 'effect';
import { assert, describe, expect, it } from 'vitest';
import * as z from 'zod';

import { stringToRedacted, transformFlattenedError } from '~/.server/utils/zod-utils';

describe('transformFlattenedError', () => {
  it('should transform a flattened error object with multiple fields and multiple error messages', () => {
    const flattenedError = {
      fieldErrors: {
        name: ['Name is required', 'Name is too short'],
        age: ['Age must be a number'],
      },
    };
    const expectedResult = {
      name: 'Name is required',
      age: 'Age must be a number',
    };
    const result = transformFlattenedError(flattenedError);
    expect(result).toEqual(expectedResult);
  });

  it('should transform a flattened error object with fields that have a single error message', () => {
    const flattenedError = {
      fieldErrors: {
        name: ['Name is required'],
        age: ['Age must be a number'],
      },
    };
    const expectedResult = {
      name: 'Name is required',
      age: 'Age must be a number',
    };
    const result = transformFlattenedError(flattenedError);
    expect(result).toEqual(expectedResult);
  });

  it('should transform a flattened error object with fields that have no error messages', () => {
    const flattenedError = {
      fieldErrors: {
        name: [],
        age: [],
      },
    };
    const expectedResult = {
      name: undefined,
      age: undefined,
    };
    const result = transformFlattenedError(flattenedError);
    expect(result).toEqual(expectedResult);
  });

  it('should transform an empty flattened error object', () => {
    const flattenedError = {
      fieldErrors: {},
    };
    const expectedResult = {};
    const result = transformFlattenedError(flattenedError);
    expect(result).toEqual(expectedResult);
  });
});

describe('stringToRedacted', () => {
  const schema = z.object({ name: z.string(), token: stringToRedacted });

  it('redacts selected fields after a successful parse', () => {
    const result = schema.safeParse({ name: 'Jane', token: 'secret' });

    assert(result.success);
    expect(result.data.name).toBe('Jane');
    expect(Redacted.isRedacted(result.data.token)).toBe(true);
    expect(Redacted.value(result.data.token)).toBe('secret');
  });

  it('encodes redacted fields back to raw strings', () => {
    const parsed = schema.parse({ name: 'Jane', token: 'secret' });
    expect(z.encode(schema, parsed)).toEqual({ name: 'Jane', token: 'secret' });
  });

  it('rejects invalid raw inputs', () => {
    expect(schema.safeParse({ name: 'Jane', token: 42 }).success).toBe(false);
  });
});
