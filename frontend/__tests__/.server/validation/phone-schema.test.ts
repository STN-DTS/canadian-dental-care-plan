import { assert, describe, expect, it } from 'vitest';
import * as z from 'zod';

import { phoneSchema } from '~/.server/validation/phone-schema';

describe('phoneSchema', () => {
  it('should pass validation for a valid Canadian phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '613-555-1212' });
    assert(result.success);
    expect(result.data).toStrictEqual({
      phone: '+1 613 555 1212',
    });
  });

  it('should pass validation for a valid international phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '+442071838750' });
    assert(result.success);
    expect(result.data).toStrictEqual({
      phone: '+44 20 7183 8750',
    });
  });

  it('should pass validation for a valid Canadian phone number with leading +1', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '+16135551212' });
    assert(result.success);
    expect(result.data).toStrictEqual({
      phone: '+1 613 555 1212',
    });
  });

  it('should fail validation for an invalid Canadian phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '123-4567' });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'custom',
        fatal: true,
        message: 'Invalid Canadian phone number, received 123-4567',
        path: ['phone'],
      },
    ]);
  });

  it('should fail validation for an invalid international phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '+12 345 555 1212' });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'custom',
        fatal: true,
        message: 'Invalid international phone number, received +12 345 555 1212',
        path: ['phone'],
      },
    ]);
  });

  it('should pass validation for optional phone number', () => {
    const result = z.object({ phone: phoneSchema().optional() }).safeParse({});
    assert(result.success);
    expect(result.data).toStrictEqual({});
  });

  it('should fail validation for undefined phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({});
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Phone number is required',
        path: ['phone'],
      },
    ]);
  });

  it('should pass validation for nullable phone number', () => {
    const result = z.object({ phone: phoneSchema().nullable() }).safeParse({ phone: null });
    assert(result.success);
    expect(result.data).toStrictEqual({ phone: null });
  });

  it('should fail validation for null phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: null });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'invalid_type',
        expected: 'string',
        message: 'Invalid phone number type. Expected string, received null',
        path: ['phone'],
      },
    ]);
  });

  it('should fail validation for an empty phone number', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '' });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        inclusive: true,
        message: 'Phone number is required',
        minimum: 1,
        origin: 'string',
        path: ['phone'],
      },
    ]);
  });

  it('should fail validation for a phone number with only spaces', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: ' '.repeat(3) });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'too_small',
        inclusive: true,
        message: 'Phone number is required',
        minimum: 1,
        origin: 'string',
        path: ['phone'],
      },
    ]);
  });

  it('should correctly format a valid Canadian phone number with spaces', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '613 555 1212' });
    assert(result.success);
    expect(result.data).toStrictEqual({ phone: '+1 613 555 1212' });
  });

  it('should correctly format a valid Canadian phone number with parenthesis and spaces', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '(613) 555-1212' });
    assert(result.success);
    expect(result.data).toStrictEqual({ phone: '+1 613 555 1212' });
  });

  it('should handle phone number with invalid characters', () => {
    const result = z.object({ phone: phoneSchema() }).safeParse({ phone: '613-555-1212!' });
    assert(!result.success);
    expect(result.error.issues).toStrictEqual([
      {
        code: 'custom',
        fatal: true,
        message: 'Invalid Canadian phone number, received 613-555-1212!',
        path: ['phone'],
      },
    ]);
  });
});
