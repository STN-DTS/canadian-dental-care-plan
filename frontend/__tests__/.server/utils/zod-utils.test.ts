import { describe, expect, it } from 'vitest';

import { transformFlattenedError } from '~/.server/utils/zod-utils';

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
