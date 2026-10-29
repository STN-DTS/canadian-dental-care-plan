import { renderHook } from '@testing-library/react';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractDateParts,
  getAgeFromDate,
  getAgeFromDateString,
  getAgeFromDateTimeString,
  getCurrentDateString,
  isPastDate,
  isPastDateString,
  isPastDateTimeString,
  isValidDateString,
  isValidDateTimeString,
  isValidTimeZone,
  parseDateString,
  parseDateTimeString,
  toLocaleDateString,
  toLocaleString,
  useMonths,
} from '~/utils/date-utils';

/*
 * @vitest-environment jsdom
 */

beforeEach(() => {
  vi.useFakeTimers({ now: Temporal.Instant.from('2024-01-01T00:00:00Z') });
});

describe('extractDateParts', () => {
  it('should parse valid date string correctly', () => {
    expect(extractDateParts('2024-03-18')).toEqual({
      year: '2024',
      month: '03',
      day: '18',
    });
    expect(extractDateParts('1999-12-31')).toEqual({
      year: '1999',
      month: '12',
      day: '31',
    });
    expect(extractDateParts('2024-02-29')).toEqual({
      year: '2024',
      month: '02',
      day: '29',
    });
  });

  it('should return an empty object for an invalid date string', () => {
    expect(extractDateParts('')).toEqual({});
    expect(extractDateParts('2024-13-18')).toEqual({});
    expect(extractDateParts('2024-03-32')).toEqual({});
    expect(extractDateParts('2024-03')).toEqual({});
    expect(extractDateParts('hello')).toEqual({});
    expect(extractDateParts('2024-03-18-')).toEqual({});
    expect(extractDateParts('-03-18')).toEqual({});
    expect(extractDateParts('2024--18')).toEqual({});
    expect(extractDateParts('2024-03-')).toEqual({});
  });

  it('pads numeric form fields before parsing', () => {
    expect(extractDateParts('2024-3-8')).toEqual({ year: '2024', month: '03', day: '08' });
  });

  it('should return an empty object if the date does not exist', () => {
    expect(extractDateParts('2023-02-29')).toEqual({});
    expect(extractDateParts('2024-02-30')).toEqual({});
    expect(extractDateParts('2100-02-29')).toEqual({});
  });
});

describe('useMonths', () => {
  it('should return an array of result.current with default format', () => {
    const { result } = renderHook(() => useMonths('en'));
    expect(result.current).toHaveLength(12);
    expect(result.current[0]).toHaveProperty('index', 1);
    expect(result.current[0]).toHaveProperty('text', 'January');
  });

  it('should return an array of result.current with specified format', () => {
    const { result } = renderHook(() => useMonths('en', 'short'));
    expect(result.current).toHaveLength(12);
    expect(result.current[0]).toHaveProperty('index', 1);
    expect(result.current[0]).toHaveProperty('text', 'Jan');
  });

  it('should return an array of result.current with custom locale', () => {
    const { result } = renderHook(() => useMonths('fr'));
    expect(result.current).toHaveLength(12);
    expect(result.current[0]).toHaveProperty('index', 1);
    expect(result.current[0]).toHaveProperty('text', 'janvier');
  });

  describe('getAgeFromDateString', () => {
    it('should return the age from a given date string', () => {
      expect(getAgeFromDateString('2000-01-01')).toEqual(24);
    });

    it('should return the age rounded down to closest full year from a given date string', () => {
      expect(getAgeFromDateString('2000-01-02')).toEqual(23);
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => getAgeFromDateString('abcd-ef-gh')).toThrowError();
    });

    it('should return age when reference date is passed', () => {
      expect(getAgeFromDateString('2000-01-01', '2024-12-31')).toEqual(24);
      expect(getAgeFromDateString('2000-01-01', '2025-01-01')).toEqual(25);
    });
  });

  describe('getAgeFromDateTimeString', () => {
    it('should return the age from a given datetime string', () => {
      expect(getAgeFromDateTimeString('2000-01-01T00:00:00.000Z')).toEqual(24);
    });

    it('should return the age rounded down to closest full year from a given datetime string', () => {
      expect(getAgeFromDateTimeString('2000-01-02T00:00:00.000Z')).toEqual(23);
    });

    it('should throw an error for an invalid datetime string', () => {
      expect(() => getAgeFromDateTimeString('abcd-ef-gh')).toThrowError();
    });

    it('should return age when reference date is passed', () => {
      expect(getAgeFromDateTimeString('2000-01-02T00:00:00.000Z', '2025-01-01T23:59:59.999Z')).toEqual(24);
      expect(getAgeFromDateTimeString('2000-01-02T00:00:00.000Z', '2025-01-02T00:00:00.000Z')).toEqual(25);
    });
  });

  describe('getAgeFromDate', () => {
    it('should return the age from a calendar date with the default reference date', () => {
      expect(getAgeFromDate(Temporal.PlainDate.from('2000-01-01'))).toEqual(24);
    });

    it('should return completed years from a calendar date', () => {
      expect(getAgeFromDate(Temporal.PlainDate.from('2000-01-02'))).toEqual(23);
    });

    it('should throw an error if the calendar date is in the future', () => {
      expect(() => getAgeFromDate(Temporal.PlainDate.from('3000-01-01'))).toThrowError();
    });

    it('should calculate age as of a specific reference date in the future', () => {
      expect(getAgeFromDate(Temporal.PlainDate.from('2000-01-01'), Temporal.PlainDate.from('2030-01-01'))).toEqual(30);
    });

    it('should throw an error if referenceDate is before the birthdate', () => {
      expect(() => getAgeFromDate(Temporal.PlainDate.from('2000-02-02'), Temporal.PlainDate.from('2000-02-01'))).toThrowError();
    });
  });

  describe('isPastDateString', () => {
    it('should return true if a date is in the past', () => {
      expect(isPastDateString('2000-01-01')).toEqual(true);
    });

    it('should return false if a date is in the future', () => {
      expect(isPastDateString('3000-01-01')).toEqual(false);
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => isPastDateString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('isPastDateTimeString', () => {
    it('should return true if a datetime is in the past', () => {
      expect(isPastDateTimeString('2000-01-01T00:00:00.000Z')).toEqual(true);
    });

    it('should return false if a datetime is in the future', () => {
      expect(isPastDateTimeString('3000-01-01T00:00:00.000Z')).toEqual(false);
    });

    it('should throw an error for an invalid datetime string', () => {
      expect(() => isPastDateTimeString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('isPastDate', () => {
    it('should return true if a calendar date is in the past', () => {
      expect(isPastDate(Temporal.PlainDate.from('2000-01-01'))).toEqual(true);
    });

    it('should return false if a calendar date is in the future', () => {
      expect(isPastDate(Temporal.PlainDate.from('3000-01-01'))).toEqual(false);
    });
  });

  describe('isValidDateString', () => {
    it('returns the parsed calendar date for a valid date string', () => {
      expect(isValidDateString('2000-01-01')).toEqual({ valid: true, date: Temporal.PlainDate.from('2000-01-01') });
    });

    it('returns the parse error for an invalid date string', () => {
      expect(isValidDateString('acde-ef-gh')).toEqual({ valid: false, error: expect.any(RangeError) });
    });

    it('rejects nonexistent calendar dates', () => {
      expect(isValidDateString('2024-02-30')).toEqual({ valid: false, error: expect.any(RangeError) });
    });
  });

  describe('isValidDateTimeString', () => {
    it('returns the parsed instant for a valid datetime string', () => {
      expect(isValidDateTimeString('2000-01-01T15:30:00.000Z')).toEqual({ valid: true, date: Temporal.Instant.from('2000-01-01T15:30:00Z') });
    });

    it('returns the parse error for an invalid datetime string', () => {
      expect(isValidDateTimeString('acde-ef-gh')).toEqual({ valid: false, error: expect.any(RangeError) });
    });
  });

  describe('parseDateString', () => {
    it('should return a calendar date given a valid date string', () => {
      expect(parseDateString('2000-01-01')).toEqual(Temporal.PlainDate.from('2000-01-01'));
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => parseDateString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('parseDateTimeString', () => {
    it('should return an instant given a valid timestamp string', () => {
      expect(parseDateTimeString('2000-01-01T00:00:00.000Z')).toEqual(Temporal.Instant.from('2000-01-01T00:00:00.000Z'));
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => parseDateTimeString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('toLocaleDateString', () => {
    it('should format a calendar date in English', () => {
      expect(toLocaleDateString(Temporal.PlainDate.from('2000-01-01'), 'en', { timeZone: 'UTC' })).toEqual('January 1, 2000');
    });

    it('should format a calendar date in French', () => {
      expect(toLocaleDateString(Temporal.PlainDate.from('2000-01-01'), 'fr', { timeZone: 'UTC' })).toEqual('1 janvier 2000');
    });

    it('should throw an error for an invalid Canadian locale', () => {
      expect(() => toLocaleDateString(Temporal.PlainDate.from('2000-01-01'), 'xy')).toThrowError();
    });

    it('should format date in UTC when timeZone is explicitly set to UTC', () => {
      // 2024-01-15 23:00 UTC is still Jan 15 in UTC
      expect(toLocaleDateString(Temporal.Instant.from('2024-01-15T23:00:00.000Z'), 'en', { timeZone: 'UTC' })).toEqual('January 15, 2024');
    });

    it('should format date adjusted to the specified timeZone', () => {
      // 2024-01-15 23:00 UTC is Jan 16 in Asia/Tokyo (UTC+9)
      expect(toLocaleDateString(Temporal.Instant.from('2024-01-15T23:00:00.000Z'), 'en', { timeZone: 'Asia/Tokyo' })).toEqual('January 16, 2024');
    });

    it('should format date in a negative offset timeZone', () => {
      // 2024-01-16 03:00 UTC is still Jan 15 in America/Vancouver (UTC-8)
      expect(toLocaleDateString(Temporal.Instant.from('2024-01-16T03:00:00.000Z'), 'en', { timeZone: 'America/Vancouver' })).toEqual('January 15, 2024');
    });

    it('should format date in French with a timeZone option', () => {
      // 2024-01-15 23:00 UTC is Jan 16 in Asia/Tokyo (UTC+9)
      expect(toLocaleDateString(Temporal.Instant.from('2024-01-15T23:00:00.000Z'), 'fr', { timeZone: 'Asia/Tokyo' })).toEqual('16 janvier 2024');
    });
  });

  describe('toLocaleString', () => {
    it('should format a localized date and time with the English locale default and timezone abbreviation', () => {
      expect(toLocaleString(Temporal.Instant.from('2024-07-15T23:15:00.000Z'), 'en', { timeZone: 'Canada/Eastern' })).toEqual('July 15, 2024 at 7:15 p.m. EDT');
    });

    it('should format a localized date and time with the French locale default and timezone abbreviation', () => {
      expect(toLocaleString(Temporal.Instant.from('2024-07-15T23:15:00.000Z'), 'fr', { timeZone: 'Canada/Eastern' })).toEqual('15 juillet 2024 à 19 h 15 HAE');
    });

    it('should use the timezone standard abbreviation outside daylight time', () => {
      expect(toLocaleString(Temporal.Instant.from('2024-01-15T23:15:00.000Z'), 'en', { timeZone: 'Canada/Eastern' })).toEqual('January 15, 2024 at 6:15 p.m. EST');
    });

    it('should throw an error for an invalid Canadian locale', () => {
      expect(() => toLocaleString(Temporal.Instant.from('2024-07-15T23:15:00.000Z'), 'xy', { timeZone: 'Canada/Eastern' })).toThrow();
    });
  });
});

describe('isValidTimeZone', () => {
  it('should return true for valid IANA time zone strings', () => {
    expect(isValidTimeZone('America/Toronto')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
    expect(isValidTimeZone('America/Vancouver')).toBe(true);
    expect(isValidTimeZone('Europe/London')).toBe(true);
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidTimeZone('Canada/Central')).toBe(true);
  });

  describe('calendar and instant boundaries', () => {
    it('rejects nonexistent dates instead of constraining form fields', () => {
      expect(extractDateParts('2024-02-30')).toEqual({});
      expect(extractDateParts('2100-02-29')).toEqual({});
      expect(() => parseDateString('2024-02-30')).toThrow();
      expect(parseDateString('2024-02-29').toString()).toBe('2024-02-29');
    });

    it('keeps birthdays on the same calendar day in every display timezone', () => {
      const birthdate = parseDateString('2000-01-01');

      for (const timeZone of ['UTC', 'America/Toronto', 'America/Vancouver', 'Asia/Tokyo']) {
        expect(toLocaleDateString(birthdate, 'en', { timeZone })).toBe('January 1, 2000');
        expect(toLocaleDateString(birthdate, 'fr', { timeZone })).toBe('1 janvier 2000');
      }
    });

    it('keeps the existing March 1 leap-day age boundary', () => {
      expect(getAgeFromDateString('2000-02-29', '2023-02-28')).toBe(22);
      expect(getAgeFromDateString('2000-02-29', '2023-03-01')).toBe(23);
      expect(getAgeFromDateTimeString('2000-02-29T12:00:00Z', '2023-02-28T12:00:00Z')).toBe(22);
      expect(getAgeFromDateTimeString('2000-02-29T12:00:00Z', '2023-03-01T12:00:00Z')).toBe(23);
    });

    it.each([16, 18, 65])('changes age on the %i birthday', (age) => {
      expect(getAgeFromDateString('1900-07-01', `${1900 + age}-06-30`)).toBe(age - 1);
      expect(getAgeFromDateString('1900-07-01', `${1900 + age}-07-01`)).toBe(age);
    });

    it('uses Temporal timestamp validation and preserves nanosecond precision', () => {
      expect(isValidDateTimeString('2024-01-01T00:00:00+00:00')).toEqual({ valid: true, date: Temporal.Instant.from('2024-01-01T00:00:00Z') });
      expect(isValidDateTimeString('2024-01-01T00:00:00')).toEqual({ valid: false, error: expect.any(RangeError) });
      expect(parseDateTimeString('2024-01-01T00:00:00.123456789Z').toString()).toBe('2024-01-01T00:00:00.123456789Z');
      expect(isValidDateTimeString('2024-01-01T00:00:00.123456789123Z')).toEqual({ valid: false, error: expect.any(RangeError) });
    });

    it('uses the Vitest clock for UTC today and the same-day birthdate check', () => {
      vi.setSystemTime(Temporal.Instant.from('2024-01-01T12:00:00Z').epochMilliseconds);
      expect(getCurrentDateString()).toBe('2024-01-01');
      expect(isPastDateString('2024-01-01')).toBe(true);
      expect(isPastDateString('2024-01-02')).toBe(false);
      expect(getAgeFromDateString('2024-01-01')).toBe(0);
      vi.advanceTimersByTime(12 * 60 * 60 * 1000);
      expect(getCurrentDateString()).toBe('2024-01-02');
    });

    it('distinguishes changing the clock from advancing scheduled timers', () => {
      const callback = vi.fn();
      setTimeout(callback, 1000);
      vi.setSystemTime(Temporal.Instant.from('2024-01-02T00:00:00Z').epochMilliseconds);
      expect(callback).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1000);
      expect(callback).toHaveBeenCalledOnce();
    });
  });

  it('should return false for invalid IANA time zone strings', () => {
    expect(isValidTimeZone('Invalid/Timezone')).toBe(false);
    expect(isValidTimeZone('America/InvalidCity')).toBe(false);
    expect(isValidTimeZone('NotATimeZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('12345')).toBe(false);
  });
});
