import { useMemo } from 'react';

import { invariant } from '@dts-stn/invariant';

import { padWithZero } from '~/utils/string-utils';

/**
 * Parses a date string in the format "YYYY-MM-DD" and returns an object with the parsed components.
 * @param date The date string to parse.
 * @returns An object containing the parsed components (year, month, day). Returns an empty object if parsing fails or if the date does not exist.
 */
export function extractDateParts(date: string) {
  const normalized = date
    .split('-')
    .map((part, index) => (part.length > 0 ? part.padStart(index === 0 ? 4 : 2, '0') : part))
    .join('-');
  const result = isValidDateString(normalized);

  if (!result.valid) {
    return {};
  }

  const { year, month, day } = result.date;
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
  const result = isValidDateString(date);
  invariant(result.valid, `date is invalid [${date}]`);

  if (!referenceDate) {
    return getAgeFromDate(result.date);
  }

  const reference = isValidDateString(referenceDate);
  invariant(reference.valid, `referenceDate is invalid [${referenceDate}]`);
  return getAgeFromDate(result.date, reference.date);
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
  const date = parseDateTimeString(dateTime);
  const reference = referenceDateTime ? parseDateTimeString(referenceDateTime) : Temporal.Now.instant();
  invariant(Temporal.Instant.compare(date, Temporal.Now.instant()) < 0, `dateTime must be in past [${dateTime}]`);
  invariant(Temporal.Instant.compare(reference, date) >= 0, `referenceDateTime [${reference}] must not be earlier than dateTime [${date}]`);
  return date.toZonedDateTimeISO('UTC').until(reference.toZonedDateTimeISO('UTC'), { largestUnit: 'years' }).years;
}

/**
 * Calculates the difference in full years between two dates.
 * If no specific date is provided, it defaults to today's date.
 *
 * @param date Calendar date of birth.
 * @param referenceDate Calendar reference date. Defaults to today's UTC date.
 * @returns Difference in completed years.
 * @throws Error if the birthdate is in the future or the reference date precedes it.
 */
export function getAgeFromDate(date: Temporal.PlainDate, referenceDate: Temporal.PlainDate = Temporal.Now.plainDateISO('UTC')) {
  invariant(isPastDate(date), `date must be in past [${date}]`);
  invariant(Temporal.PlainDate.compare(referenceDate, date) >= 0, `referenceDate [${referenceDate}] must not be earlier than date [${date}]`);
  return date.until(referenceDate, { largestUnit: 'years' }).years;
}

export function isPastDateString(date: string) {
  return isPastDate(parseDateString(date));
}

export function isPastDateTimeString(dateTime: string) {
  return Temporal.Instant.compare(parseDateTimeString(dateTime), Temporal.Now.instant()) < 0;
}

export function isPastDate(date: Temporal.PlainDate) {
  return Temporal.PlainDateTime.compare(date.toPlainDateTime(), Temporal.Now.plainDateTimeISO('UTC')) < 0;
}

/** Validates and parses a calendar date with Temporal. */
export function isValidDateString(date: string): { valid: true; date: Temporal.PlainDate } | { valid: false; error: RangeError } {
  try {
    return { valid: true, date: Temporal.PlainDate.from(date, { overflow: 'reject' }) };
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    return { valid: false, error };
  }
}

/** Validates and parses a timestamp with Temporal, retaining millisecond precision. */
export function isValidDateTimeString(dateTime: string): { valid: true; date: Temporal.Instant } | { valid: false; error: RangeError } {
  try {
    return { valid: true, date: Temporal.Instant.from(dateTime.replace(/(\.\d{3})\d+(?=Z$)/, '$1')) };
  } catch (error) {
    if (!(error instanceof RangeError)) {
      throw error;
    }

    return { valid: false, error };
  }
}

/** Parses a validated YYYY-MM-DD calendar date without applying a timezone. */
export function parseDateString(date: string) {
  const result = isValidDateString(date);
  invariant(result.valid, `date is invalid [${date}]`);
  return result.date;
}

/** Parses a validated UTC timestamp, retaining the existing millisecond precision. */
export function parseDateTimeString(dateTime: string) {
  const result = isValidDateTimeString(dateTime);
  invariant(result.valid, `dateTime is invalid [${dateTime}]`);
  return result.date;
}

/**
 * Formats a calendar date or an instant as a long Canadian date.
 *
 * @param date Calendar date or instant to format. Calendar dates never shift timezones.
 * @param locale Language code. Supported values are `en` and `fr`.
 * @param options Optional Intl time zone option. Use an IANA time zone such as `UTC` or `America/Toronto`.
 * @returns Localized long date, such as `January 15, 2024` or `15 janvier 2024`.
 * @throws {Error} If `locale` is not `en` or `fr`.
 * @example
 * const date = Temporal.PlainDate.from('2024-01-15');
 * const result = toLocaleDateString(date, 'en', { timeZone: 'UTC' }); // "January 15, 2024"
 */
export function toLocaleDateString(date: Temporal.PlainDate | Temporal.Instant, locale: string, options?: Pick<Intl.DateTimeFormatOptions, 'timeZone'>) {
  invariant(/^(en|fr)$/i.test(locale), `Canadian locale is invalid [${locale}]`);
  const calendarDate = date instanceof Temporal.Instant ? date.toZonedDateTimeISO(options?.timeZone ?? 'UTC').toPlainDate() : date;
  return calendarDate.toLocaleString(`${locale}-CA`, { dateStyle: 'long' });
}

export function toLocaleString(date: Temporal.Instant, locale: string, options?: Pick<Intl.DateTimeFormatOptions, 'timeZone'>) {
  invariant(/^(en|fr)$/i.test(locale), `Canadian locale is invalid [${locale}]`);

  return date.toZonedDateTimeISO(options?.timeZone ?? 'UTC').toLocaleString(`${locale}-CA`, {
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
    return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((monthIndex) => {
      const date = Temporal.PlainDate.from({ year: 2017, month: monthIndex, day: 1 });
      return {
        index: monthIndex,
        text: date.toLocaleString(`${locale}-CA`, { month: format }),
      };
    });
  }, [format, locale]);
}

/**
 * Custom function that returns the current date formatted ex.: 2020-12-30.
 * @returns the current date as a string.
 */
export function getCurrentDateString(locale: AppLocale = 'en'): string {
  return Temporal.Now.plainDateISO('UTC').toLocaleString(`${locale}-CA`);
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
