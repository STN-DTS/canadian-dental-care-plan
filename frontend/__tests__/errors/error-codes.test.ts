import { describe, expect, it } from 'vitest';

import { ErrorCodes, isErrorCode } from '~/errors/error-codes';

describe('ErrorCodes', () => {
  it('uses unique domain-subdomain identifiers', () => {
    const values = Object.values(ErrorCodes);

    expect(values).toHaveLength(116);
    expect(new Set(values).size).toBe(values.length);
    expect(values.every((value) => /^(API|APP|AUTH|DEV|PLT)-[A-Z]{2,10}-[0-9]{4}$/.test(value))).toBe(true);

    const groups = new Map<string, string[]>();

    for (const value of values) {
      const prefix = value.slice(0, value.lastIndexOf('-'));
      groups.set(prefix, [...(groups.get(prefix) ?? []), value]);
    }

    for (const [prefix, codes] of groups) {
      const numbers = codes.map((code) => Number(code.slice(code.lastIndexOf('-') + 1))).sort((a, b) => a - b);
      expect({ prefix, numbers }).toEqual({ prefix, numbers: Array.from({ length: numbers.length }, (_, index) => index + 1) });
    }
  });

  it('keeps the SIN status rate-limit code distinct from basic-info lookups', () => {
    expect(ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED).toBe('API-STATUS-0002');
    expect(ErrorCodes.API_STATUS_FIND_BY_BASIC_INFO_RATE_LIMITED).toBe('API-STATUS-0001');
  });

  it('accepts only active codes', () => {
    expect(Object.values(ErrorCodes).every(isErrorCode)).toBe(true);
    expect(isErrorCode(ErrorCodes.API_STATUS_FIND_BY_SIN_RATE_LIMITED)).toBe(true);
    expect(isErrorCode('XAPI-0002')).toBe(false);
    expect(isErrorCode('API-UNKNOWN-0001')).toBe(false);
    expect(isErrorCode('__proto__')).toBe(false);
    expect(isErrorCode(null)).toBe(false);
  });
});
