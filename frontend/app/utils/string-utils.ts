/**
 * Expand the given string template using the provided variables.
 * A string template uses handlebar notation to denote placeholders. For example:
 *
 * expandTemplate('{greeting}, {subject}!', { greeting: 'Hello', subject: 'world' }) → 'Hello, world!
 */
export function expandTemplate(template: string, variables: Record<string, string>) {
  return Object.entries(variables).reduce((t, [key, value]) => t.replace(`{${key}}`, value), template);
}

/**
 * Generate a random string using only hex characters.
 */
export function randomHexString(len: number) {
  return randomString(len, '0123456789abcdef');
}

/**
 * Generate a random string using the provided characters, or alphanumeric characters if none are provided.
 */
export function randomString(length: number, allowedChars = '0123456789abcdefghijklmnopqrstuvwxyz') {
  const toRandomChar = () => allowedChars[Math.floor(Math.random() * allowedChars.length)];
  return Array.from({ length }).map(toRandomChar).join('');
}

/**
 * Pads a number with zeros to the left to reach the specified length.
 * If the value is not a number or its length is greater than or equal to maxLength, it returns the value as a string.
 * @param value - The number to pad.
 * @param maxLength - The maximum length of the resulting string.
 * @returns The padded string or the value as a string if it's not a number or its length is already greater than or equal to maxLength.
 */
export const padWithZero = (value: number, maxLength: number) => {
  if (Number.isNaN(value)) return value.toString();
  if (value.toString().length >= maxLength) return value.toString();
  return value.toString().padStart(maxLength, '0');
};

export const invalidInputCharactersRegex = /[^a-zA-Z0-9(),\-.'\u2019\s\u00A0ÀÁÂÄÇÈÉÊËÌÍÎÏÒÓÔÖÙÚÛÜÝàáâäçèéêëìíîïòóôöùúûüýÿ]/g;

/**
 * Checks if the input string contains only valid characters.
 *
 * @param value - The input string to be checked.
 * @returns - Returns true if the input contains only valid characters, otherwise false.
 */
export function isAllValidInputCharacters(value: string) {
  const hasInvalidCharacters = invalidInputCharactersRegex.test(value);
  return !hasInvalidCharacters;
}

/**
 * Removes invalid characters from the input string based on a predefined regular expression.
 *
 * @param value - The input string to be filtered.
 * @returns - The filtered string with invalid characters removed.
 */
export function removeInvalidInputCharacters(value: string) {
  return value.replaceAll(invalidInputCharactersRegex, '');
}

/**
 *
 * @param value - The input string to be checked.
 * @returns - Returns true if the input contains digits, otherwise false.
 */
export function hasDigits(value: string) {
  return /\d/.test(value);
}

/**
 * Normalizes hyphens in the input string by replacing sequences of two or more hyphens with a single hyphen.
 *
 * @param str - The input string to normalize.
 * @returns - The normalized string with sequences of hyphens replaced by a single hyphen.
 */
export function normalizeHyphens(str: string) {
  return str.replaceAll(/-{2,}/g, '-');
}

/**
 * @param value - The whole number percentage (i.e. multiplied by 100) to be formatted
 * @param locale - The Canadian locale to be used for formatting
 * @returns - The number formatted as a percentage in the givenlocale
 */
export function formatPercent(value: number, locale: string) {
  if (!/en|fr/i.test(locale)) throw new Error(`locale must be 'en' or 'fr'`);
  return Intl.NumberFormat(`${locale}-CA`, { style: 'percent' }).format(value / 100);
}

/**
 * Extracts only digits from a string by removing all non-digit characters
 * @param input - The input string to process
 * @returns A string containing only digits (0-9)
 * @example
 * extractDigits("123-456-7890") // returns "1234567890"
 */
export function extractDigits(input: string) {
  return input.match(/\d/g)?.join('') ?? '';
}

/**
 * Normalizes spaces in a string by replacing all whitespace characters
 * (including non-breaking spaces) with regular spaces.
 *
 * @param str - The string to normalize.
 * @returns The normalized string with all spaces replaced by regular spaces.
 */
export function normalizeSpaces(str: string) {
  return str.replaceAll(/[\s\u00A0]/g, ' ');
}

/**
 * Arguments for formatting just the address line
 */
interface FormatAddressLineArguments {
  /** Street address */
  address: string;
  /** Apartment, suite, or unit number */
  apartment?: string;
}

/**
 * Formats an apartment/suite number with the address
 * @param params Address line formatting parameters
 * @returns Formatted address line
 */
export function formatAddressLine({ address, apartment }: FormatAddressLineArguments): string {
  if (!apartment?.trim()) {
    return address;
  }

  // Check if apartment is a simple alphanumeric suite number
  const isSuiteNumber = /^[a-z\d]+$/i.test(apartment.trim());

  return isSuiteNumber ? `${apartment.trim()}-${address}` : `${address} ${apartment.trim()}`;
}

/**
 * Arguments for formatting a complete address
 */
interface FormatAddressArguments {
  /** Street address */
  address: string;

  /** City name */
  city: string;

  /** Country name */
  country: string;

  /** Province or state code (optional) */
  provinceState?: string;

  /** Postal or ZIP code (optional) */
  postalZipCode?: string;

  /** Apartment, suite, or unit number (optional) */
  apartment?: string;

  /**
   * The format of the address
   *
   * - `standard`: The standard address format, with the address line, city, province/state, postal/zip code, and country.
   * - `alternative`: An alternative address format, with the address line, city, province/state, postal/zip code, and country on separate lines.
   */
  format?: 'standard' | 'alternative';
}

/**
 * Formats an address string based on the provided arguments.
 *
 * @param params Address formatting parameters
 * @returns Formatted address string
 */
export function formatAddress({ address, city, country, provinceState, postalZipCode, apartment, format = 'standard' }: FormatAddressArguments): string {
  const formattedAddressLine = formatAddressLine({ address, apartment });

  // prettier-ignore
  const lines = format === 'alternative'
    ? [
      formattedAddressLine,
      [city, provinceState && `, ${provinceState}`].filter(Boolean).join(''),
      postalZipCode,
      country
    ] : [
      formattedAddressLine,
      [city, provinceState && ` ${provinceState}`, postalZipCode && `  ${postalZipCode}`].filter(Boolean).join(''),
      country
    ];

  return lines
    .map((line) => line?.trim())
    .filter(Boolean)
    .join('\n');
}
