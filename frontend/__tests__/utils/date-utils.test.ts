import { renderHook } from '@testing-library/react';

import { UTCDate } from '@date-fns/utc';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  extractDateParts,
  getAgeFromDate,
  getAgeFromDateString,
  getAgeFromDateTimeString,
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
  vi.useFakeTimers();
  vi.setSystemTime('2024-01-01');
});

afterEach(() => {
  vi.useRealTimers();
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
    it('should return the age from a given UTC date object with default date', () => {
      expect(getAgeFromDate(new UTCDate(2000, 0, 1))).toEqual(24);
    });

    it('should return the age rounded down to closest full year from a given UTC date object with default date', () => {
      expect(getAgeFromDate(new UTCDate(2000, 0, 2))).toEqual(23);
    });

    it('should throw an error if the UTC date is in the future', () => {
      expect(() => getAgeFromDate(new UTCDate(3000, 0, 1))).toThrowError();
    });

    it('should calculate age as of a specific reference date in the future', () => {
      expect(getAgeFromDate(new UTCDate(2000, 0, 1), new UTCDate(2030, 0, 1))).toEqual(30);
    });

    it('should throw an error if referenceDate is before the UTC date', () => {
      expect(() => getAgeFromDate(new UTCDate(2000, 1, 1, 24, 0, 0, 0), new UTCDate(2000, 1, 1, 23, 59, 59, 999))).toThrowError();
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
    it('should return true if a UTC date is in the past', () => {
      expect(isPastDate(new UTCDate(2000, 0, 1))).toEqual(true);
    });

    it('should return false if a UTC date is in the future', () => {
      expect(isPastDate(new UTCDate(3000, 0, 1))).toEqual(false);
    });
  });

  describe('isValidDateString', () => {
    it('should return true for a valid date string', () => {
      expect(isValidDateString('2000-01-01')).toEqual(true);
    });

    it('should return false for a valid date string', () => {
      expect(isValidDateString('acde-ef-gh')).toEqual(false);
    });
  });

  describe('isValidDateTimeString', () => {
    it('should return true for a valid datetime string', () => {
      expect(isValidDateTimeString('2000-01-01T15:30:00.000Z')).toEqual(true);
    });

    it('should return false for a valid datetime string', () => {
      expect(isValidDateTimeString('acde-ef-gh')).toEqual(false);
    });
  });

  describe('parseDateString', () => {
    it('should return a UTC date given a valid date string', () => {
      expect(parseDateString('2000-01-01')).toEqual(new UTCDate('2000-01-01T00:00:00.000Z'));
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => parseDateString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('parseDateTimeString', () => {
    it('should return a UTC date given a valid date string', () => {
      expect(parseDateTimeString('2000-01-01T00:00:00.000Z')).toEqual(new UTCDate('2000-01-01T00:00:00.000Z'));
    });

    it('should throw an error for an invalid date string', () => {
      expect(() => parseDateTimeString('abcd-ef-gh')).toThrowError();
    });
  });

  describe('toLocaleDateString', () => {
    it('should return a formatted date given a UTC date object and an "en" locale', () => {
      expect(toLocaleDateString(new UTCDate(2000, 0, 1), 'en', { timeZone: 'UTC' })).toEqual('January 1, 2000');
    });

    it('should return a formatted date given a UTC date object and an "fr" locale', () => {
      expect(toLocaleDateString(new UTCDate(2000, 0, 1), 'fr', { timeZone: 'UTC' })).toEqual('1 janvier 2000');
    });

    it('should throw an error for an invalid Canadian locale', () => {
      expect(() => toLocaleDateString(new UTCDate(2000, 0, 1), 'xy')).toThrowError();
    });

    it('should format date in UTC when timeZone is explicitly set to UTC', () => {
      // 2024-01-15 23:00 UTC is still Jan 15 in UTC
      expect(toLocaleDateString(new UTCDate('2024-01-15T23:00:00.000Z'), 'en', { timeZone: 'UTC' })).toEqual('January 15, 2024');
    });

    it('should format date adjusted to the specified timeZone', () => {
      // 2024-01-15 23:00 UTC is Jan 16 in Asia/Tokyo (UTC+9)
      expect(toLocaleDateString(new UTCDate('2024-01-15T23:00:00.000Z'), 'en', { timeZone: 'Asia/Tokyo' })).toEqual('January 16, 2024');
    });

    it('should format date in a negative offset timeZone', () => {
      // 2024-01-16 03:00 UTC is still Jan 15 in America/Vancouver (UTC-8)
      expect(toLocaleDateString(new UTCDate('2024-01-16T03:00:00.000Z'), 'en', { timeZone: 'America/Vancouver' })).toEqual('January 15, 2024');
    });

    it('should format date in French with a timeZone option', () => {
      // 2024-01-15 23:00 UTC is Jan 16 in Asia/Tokyo (UTC+9)
      expect(toLocaleDateString(new UTCDate('2024-01-15T23:00:00.000Z'), 'fr', { timeZone: 'Asia/Tokyo' })).toEqual('16 janvier 2024');
    });
  });

  describe('toLocaleString', () => {
    it('should format a localized date and time with the English locale default and timezone abbreviation', () => {
      expect(toLocaleString(new UTCDate('2024-07-15T23:15:00.000Z'), 'en', { timeZone: 'Canada/Eastern' })).toEqual('July 15, 2024 at 7:15 p.m. EDT');
    });

    it('should format a localized date and time with the French locale default and timezone abbreviation', () => {
      expect(toLocaleString(new UTCDate('2024-07-15T23:15:00.000Z'), 'fr', { timeZone: 'Canada/Eastern' })).toEqual('15 juillet 2024 à 19 h 15 HAE');
    });

    it('should use the timezone standard abbreviation outside daylight time', () => {
      expect(toLocaleString(new UTCDate('2024-01-15T23:15:00.000Z'), 'en', { timeZone: 'Canada/Eastern' })).toEqual('January 15, 2024 at 6:15 p.m. EST');
    });

    it('should throw an error for an invalid Canadian locale', () => {
      expect(() => toLocaleString(new UTCDate('2024-07-15T23:15:00.000Z'), 'xy', { timeZone: 'Canada/Eastern' })).toThrow();
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

  it('should return false for invalid IANA time zone strings', () => {
    expect(isValidTimeZone('Invalid/Timezone')).toBe(false);
    expect(isValidTimeZone('America/InvalidCity')).toBe(false);
    expect(isValidTimeZone('NotATimeZone')).toBe(false);
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('12345')).toBe(false);
  });
});
