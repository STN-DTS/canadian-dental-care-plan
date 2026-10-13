/**
 * Regular expression to validate the format of a Canadian Social Insurance Number (SIN).
 *
 * The SIN must contain exactly nine digits and may optionally include spaces or hyphens as separators:
 * - `XXXXXXXXX`
 * - `XXX XXX XXX`
 * - `XXX-XXX-XXX`
 *
 * The first digit must be between 1 and 9 (cannot start with 0).
 * For example, `000000042`, `000 000 042`, or `000-000-042` are not valid.
 *
 * Note: This regular expression validates only the format of the SIN.
 * It does not verify its validity using the Luhn algorithm; consumers must perform that check separately.
 *
 * Examples of valid formats:
 * - 123456789
 * - 123 456 789
 * - 123-456-789
 *
 * Examples of invalid formats:
 * - 000-000-000  (starts with 0)
 * - 123-45-6789  (incorrect grouping)
 * - ABC-DEF-GHI  (non-numeric characters)
 * - 123 4567 89  (invalid spacing)
 */
const sinFormatRegex = /^[1-9]\d{2}[ -]?\d{3}[ -]?\d{3}$/;

/**
 * This pattern is intended for use with the `format` property of the `InputPatternField` component.
 *
 * Example:
 * ```typescript
 * // Usage with InputPatternField
 * <InputPatternField format={sinInputPatternFormat} />
 * ```
 */
export const sinInputPatternFormat = '### ### ###';

/**
 *
 * @param sin - the Social Insurance Number (SIN)
 * @returns a boolean indicating if a SIN is valid using Luhn's Algorithm
 *
 * Luhn's Alogrithm (also known as "mod 10")
 * Social Insurance Numbers can be validated through a simple check digit process called the Luhn algorithm.
 * 046 454 286 <--- A fictitious, but valid, SIN.
 * 121 212 121 <--- Multiply every second digit by 2.
 * The result of the multiplication is:
 * 0 8 6 8 5 8 2 16 6
 * Then, add all of the digits together (note that 16 is 1+6):
 * 0 + 8 + 6 + 8 + 5 + 8 + 2 + 1+6 + 6 = 50
 * If the SIN is valid, this number will be evenly divisible by 10.
 *
 */
export function isValidSin(sin: string): boolean {
  if (!sinFormatRegex.test(sin)) {
    return false;
  }

  const multDigitString = [...sanitizeSin(sin)].map((digit, index) => Number(digit) * (index % 2 === 0 ? 1 : 2)).join('');
  const digitSum = [...multDigitString].reduce((acc, cur) => acc + Number(cur), 0);
  return digitSum % 10 === 0;
}

/**
 *
 * @param sin - the Social Insurance Number (SIN)
 * @returns a formatted SIN using a supplied separator
 */
export function formatSin(sin: string, separator = ' '): string {
  if (!isValidSin(sin)) {
    throw new Error('Invalid SIN format');
  }

  return (sanitizeSin(sin).match(/.../g) ?? []).join(separator);
}

/**
 * Sanitizes a Social Insurance Number (SIN) by removing all non-digit characters.
 * If the input does not match the expected SIN format, it is returned unchanged.
 *
 * @param sin - The SIN string to sanitize.
 * @returns The sanitized SIN containing only digits, or the original string if it doesn't match the expected format.
 */
export function sanitizeSin(sin: string): string {
  if (!sinFormatRegex.test(sin)) {
    return sin;
  }

  return sin.replaceAll(/\D/g, '');
}
