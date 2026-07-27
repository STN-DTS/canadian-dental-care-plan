import { useMemo } from 'react';

import { UTCDate } from '@date-fns/utc';
import { invariant } from '@dts-stn/invariant';
import { differenceInYears, isExists, isPast } from 'date-fns';
import * as z from 'zod';

import { padWithZero } from '~/utils/string-utils';

/**
 * Parses a date string in the format "YYYY-MM-DD" and returns an object with the parsed components.
 * @param date The date string to parse.
 * @returns An object containing the parsed components (year, month, day). Returns an empty object if parsing fails or if the date does not exist.
 */
export function extractDateParts(date: string) {
  const dateParts = date.split('-');
  if (dateParts.length !== 3) {
    return {};
  }

  const [yearStr, monthStr, dayStr] = dateParts;
  if (!yearStr || !monthStr || !dayStr) {
    return {};
  }

  const year = Number.parseInt(yearStr);
  const month = Number.parseInt(monthStr);
  const day = Number.parseInt(dayStr);

  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return {};
  }

  if (!isExists(year, month - 1, day)) {
    return {};
  }

  return {
    year: padWithZero(year, 4),
    month: padWithZero(month, 2),
    day: padWithZero(day, 2),
  };
}

/**
 * Calculates the age in full years based on a given date string.
 * The age is determined by comparing the provided date to the current date or to an optional reference date.
 *
 * @param date string representing the date (ex. '2024-01-01')
 * @param referenceDate optional string representing the reference date (ex. '2025-01-01'). If not provided, the current date is used.
 * @returns difference in full years from the current date and the input. This operation rounds the year down for fractional time differences.
 * @throws Error if the provided `date` or `referenceDate` is invalid.
 */
export function getAgeFromDateString(date: string, referenceDate?: string) {
  invariant(isValidDateString(date), `date is invalid [${date}]`);
  if (!referenceDate) {
    return getAgeFromDate(parseDateString(date));
  }

  invariant(isValidDateString(referenceDate), `referenceDate is invalid [${referenceDate}]`);
  return getAgeFromDate(parseDateString(date), parseDateString(referenceDate));
}

/**
 * Calculates the age in full years based on a given date-time string.
 * The age is determined by comparing the provided date-time to the current date-time or to an optional reference date-time.
 *
 * @param dateTime string representing the datetime (ex. '2024-01-01T00:00:00Z')
 * @param referenceDateTime (optional) string representing the reference datetime (ex. '2025-01-01T00:00:00Z'). If not provided, the current date-time is used.
 * @returns difference in full years from the current date and the input. This operation rounds the year down for fractional time differences.
 * @throws Error if the provided `dateTime` or `referenceDateTime` is invalid.
 */
export function getAgeFromDateTimeString(dateTime: string, referenceDateTime?: string) {
  invariant(isValidDateTimeString(dateTime), `dateTime is invalid [${dateTime}]`);
  if (!referenceDateTime) {
    return getAgeFromDate(parseDateTimeString(dateTime));
  }

  invariant(isValidDateTimeString(referenceDateTime), `referenceDateTime is invalid [${referenceDateTime}]`);
  return getAgeFromDate(parseDateTimeString(dateTime), parseDateTimeString(referenceDateTime));
}

/**
 * Calculates the difference in full years between two dates.
 * If no specific date is provided, it defaults to today's date.
 *
 * @param utcDate UTC date object (ex. new UTCDate(2024, 1, 1))
 * @param referenceDate Optional UTC date object to calculate the age as of that date. Defaults to today's date.
 * @returns Difference in full years between `referenceDate` (or today) and `utcDate`. This operation rounds the year down for fractional time differences.
 * @throws Error if `utcDate` is in the past or if `referenceDate` is earlier than `utcDate`.
 */
export function getAgeFromDate(utcDate: UTCDate, referenceDate: UTCDate = new UTCDate()) {
  invariant(isPastDate(utcDate), `utcDate must be in past [${utcDate}]`);
  invariant(referenceDate >= utcDate, `referenceDate [${referenceDate}] must not be earlier than utcDate [${utcDate}]`);
  return differenceInYears(referenceDate, utcDate);
}

export function isPastDateString(date: string) {
  invariant(isValidDateString(date), `date is invalid [${date}]`);
  return isPastDate(parseDateString(date));
}

export function isPastDateTimeString(dateTime: string) {
  invariant(isValidDateTimeString(dateTime), `dateTime is invalid [${dateTime}]`);
  return isPastDate(parseDateTimeString(dateTime));
}

export function isPastDate(utcDate: UTCDate) {
  return isPast(utcDate);
}

/**
 * Validates whether a given string is in the format YYYY-MM-DD.
 *
 * This function uses `z.string().date()` from the Zod library to ensure the date string
 * conforms to the standard date format (YYYY-MM-DD).
 *
 * @param date - The date string to be validated.
 * @returns Returns `true` if the string is a valid date in the format YYYY-MM-DD, otherwise `false`.
 *
 * @example
 * ```javascript
 * const validDate = "2023-05-20";
 * const invalidDate = "20-05-2023";
 *
 * console.log(isValidDateString(validDate)); // true
 * console.log(isValidDateString(invalidDate)); // false
 * ```
 */
export function isValidDateString(date: string) {
  return z.iso.date().safeParse(date).success;
}

/**
 * Validates whether a given string is a valid ISO 8601 date-time string.
 *
 * This function uses z.string().datetime() from the Zod library to ensure the date-time string
 * conforms to the ISO 8601 standard, which includes the date and time format without timezone offsets
 * and allows arbitrary sub-second decimal precision.
 *
 * @param dateTime - The date-time string to be validated.
 * @returns Returns true if the string is a valid ISO 8601 date-time, otherwise false.
 *
 * @example
 * ```javascript
 * const validDateTime = "2020-01-01T00:00:00Z";
 * const invalidDateTime = "2020-01-01 00:00:00";
 *
 * console.log(isValidDateTimeString(validDateTime)); // true
 * console.log(isValidDateTimeString(invalidDateTime)); // false
 * ```
 */
export function isValidDateTimeString(dateTime: string) {
  return z.iso.datetime().safeParse(dateTime).success;
}

/**
 * Parses a date string in the format YYYY-MM-DD and returns a UTCDate object representing the date.
 *
 * This function first validates the input date string using the `isValidDateString` function.
 * If the date string is invalid, an error is thrown. Otherwise, it constructs a new UTCDate
 * object with the date string set to the start of the day in UTC (00:00:00.000Z).
 *
 * @param date - The date string to be parsed in the format YYYY-MM-DD.
 * @throws Will throw an error if the date string is invalid.
 * @returns A UTCDate object representing the parsed date.
 *
 * @example
 * ```javascript
 * const dateString = "2023-05-20";
 * const utcDate = parseDateString(dateString);
 * console.log(utcDate); // UTCDate object representing 2023-05-20T00:00:00.000Z
 *
 * // Example with invalid date
 * const invalidDateString = "20-05-2023";
 * try {
 *   parseDateString(invalidDateString);
 * } catch (error) {
 *   console.error(error.message); // "date is invalid [20-05-2023]"
 * }
 * ```
 */
export function parseDateString(date: string) {
  invariant(isValidDateString(date), `date is invalid [${date}]`);
  return new UTCDate(`${date}T00:00:00.000Z`);
}

/**
 * Parses a date-time string in the ISO 8601 format and returns a UTCDate object representing the date-time.
 *
 * This function first validates the input date-time string using the `isValidDateTimeString` function.
 * If the date-time string is invalid, an error is thrown. Otherwise, it constructs a new UTCDate
 * object with the given date-time string.
 *
 * @param dateTime - The date-time string to be parsed in the ISO 8601 format.
 * @throws Will throw an error if the date-time string is invalid.
 * @returns A UTCDate object representing the parsed date-time.
 *
 * @example
 * ```javascript
 * const dateTimeString = "2023-05-20T15:30:00.000Z";
 * const utcDateTime = parseDateTimeString(dateTimeString);
 * console.log(utcDateTime); // UTCDate object representing 2023-05-20T15:30:00.000Z
 *
 * // Example with invalid date-time
 * const invalidDateTimeString = "20-05-2023 15:30:00";
 * try {
 *   parseDateTimeString(invalidDateTimeString);
 * } catch (error) {
 *   console.error(error.message); // "dateTime is invalid [20-05-2023 15:30:00]"
 * }
 * ```
 */
export function parseDateTimeString(dateTime: string) {
  invariant(isValidDateTimeString(dateTime), `dateTime is invalid [${dateTime}]`);
  return new UTCDate(dateTime);
}

/**
 * Formats a UTC date as a long Canadian date for the requested language.
 *
 * @param date UTC date to format.
 * @param locale Language code. Supported values are `en` and `fr`.
 * @param options Optional Intl time zone option. Use an IANA time zone such as `UTC` or `America/Toronto`.
 * @returns Localized long date, such as `January 15, 2024` or `15 janvier 2024`.
 * @throws {Error} If `locale` is not `en` or `fr`.
 * @example
 * const date = new UTCDate('2024-01-15T00:00:00.000Z');
 * const result = toLocaleDateString(date, 'en', { timeZone: 'UTC' }); // "January 15, 2024"
 */
export function toLocaleDateString(date: UTCDate, locale: string, options?: Pick<Intl.DateTimeFormatOptions, 'timeZone'>) {
  invariant(/^(en|fr)$/i.test(locale), `Canadian locale is invalid [${locale}]`);
  return date.toLocaleDateString(`${locale}-CA`, {
    timeZone: options?.timeZone,
    dateStyle: 'long',
  });
}

export function toLocaleString(date: UTCDate, locale: string, options?: Pick<Intl.DateTimeFormatOptions, 'timeZone'>) {
  invariant(/^(en|fr)$/i.test(locale), `Canadian locale is invalid [${locale}]`);

  return date.toLocaleString(`${locale}-CA`, {
    timeZone: options?.timeZone,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });
}

/**
 * Custom hook to retrieve an array of months based on the provided locale and format.
 * @param locale - The locale to use for formatting the months.
 * @param format - The format for displaying the months.
 * @returns An array containing objects with month index and formatted month text.
 */
export function useMonths(locale: string, format: 'numeric' | '2-digit' | 'long' | 'short' | 'narrow' | undefined = 'long') {
  return useMemo(() => {
    const formatter = new Intl.DateTimeFormat(`${locale}-CA`, { month: format, timeZone: 'UTC' });
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((monthIndex) => {
      const mm = monthIndex < 10 ? `0${monthIndex}` : monthIndex;
      const date = new UTCDate(`2017-${mm}-01T00:00:00Z`);
      return {
        index: monthIndex,
        text: formatter.format(date),
      };
    });
  }, [format, locale]);
}

/**
 * Custom function that returns the current date formatted ex.: 2020-12-30.
 * @returns the current date as a string.
 */
export function getCurrentDateString(locale: AppLocale = 'en'): string {
  return new UTCDate().toLocaleDateString(`${locale}-CA`);
}

/**
 * Validates whether a given timezone string is a valid IANA timezone.
 *
 * This function attempts to create a new `Intl.DateTimeFormat` object with the provided timezone.
 * If the timezone is valid, the function returns `true`. If an error is thrown, it indicates that
 * the timezone is invalid, and the function returns `false`.
 *
 * @param timeZone - The timezone string to be validated (e.g., "Canada/Eastern", "UTC", "Canada/Pacific").
 * @returns Returns `true` if the timezone is valid, otherwise `false`.
 */
export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone });
    return true;
  } catch {
    return false;
  }
}
