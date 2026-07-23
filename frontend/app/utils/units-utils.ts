/**
 * File Size Conversion Utilities
 *
 * These functions convert between different units of file size using binary (base-2) conversion.
 * 1 KB = 1024 bytes, 1 MB = 1024 KB = 1,048,576 bytes
 */
import { filesize } from 'filesize';

/**
 * Converts bytes to kilobytes.
 *
 * @param bytes - The number of bytes to convert
 * @returns The equivalent value in kilobytes
 *
 * @example
 * ```typescript
 * bytesToKilobytes(1024);  // 1
 * bytesToKilobytes(2048);  // 2
 * bytesToKilobytes(512);   // 0.5
 * ```
 */
export const bytesToKilobytes = (bytes: number): number => {
  return bytes / 1024;
};

/**
 * Converts kilobytes to bytes.
 *
 * @param kilobytes - The number of kilobytes to convert
 * @returns The equivalent value in bytes
 *
 * @example
 * ```typescript
 * kilobytesToBytes(1);   // 1024
 * kilobytesToBytes(2);   // 2048
 * kilobytesToBytes(0.5); // 512
 * ```
 */
export const kilobytesToBytes = (kilobytes: number): number => {
  return kilobytes * 1024;
};

/**
 * Converts bytes to megabytes.
 *
 * @param bytes - The number of bytes to convert
 * @returns The equivalent value in megabytes
 *
 * @example
 * ```typescript
 * bytesToMegabytes(1048576);  // 1
 * bytesToMegabytes(5242880);  // 5
 * bytesToMegabytes(524288);   // 0.5
 * ```
 */
export const bytesToMegabytes = (bytes: number): number => {
  return bytes / (1024 * 1024);
};

/**
 * Converts megabytes to bytes.
 *
 * @param megabytes - The number of megabytes to convert
 * @returns The equivalent value in bytes
 *
 * @example
 * ```typescript
 * megabytesToBytes(1);   // 1048576
 * megabytesToBytes(5);   // 5242880
 * megabytesToBytes(0.5); // 524288
 * ```
 */
export const megabytesToBytes = (megabytes: number): number => {
  return megabytes * 1024 * 1024;
};

/**
 * Converts kilobytes to megabytes.
 *
 * @param kilobytes - The number of kilobytes to convert
 * @returns The equivalent value in megabytes
 *
 * @example
 * ```typescript
 * kilobytesToMegabytes(1024); // 1
 * kilobytesToMegabytes(2048); // 2
 * kilobytesToMegabytes(512);  // 0.5
 * ```
 */
export const kilobytesToMegabytes = (kilobytes: number): number => {
  return kilobytes / 1024;
};

/**
 * Converts megabytes to kilobytes.
 *
 * @param megabytes - The number of megabytes to convert
 * @returns The equivalent value in kilobytes
 *
 * @example
 * ```typescript
 * megabytesToKilobytes(1);   // 1024
 * megabytesToKilobytes(2);   // 2048
 * megabytesToKilobytes(0.5); // 512
 * ```
 */
export const megabytesToKilobytes = (megabytes: number): number => {
  return megabytes * 1024;
};

/**
 * Time Conversion Utilities
 *
 * These functions convert between different units of time.
 */

/**
 * Converts seconds to minutes.
 *
 * @param seconds - The number of seconds to convert
 * @returns The equivalent value in minutes
 *
 * @example
 * ```typescript
 * secondsToMinutes(60);  // 1
 * secondsToMinutes(120); // 2
 * secondsToMinutes(30);  // 0.5
 * ```
 */
export const secondsToMinutes = (seconds: number): number => {
  return seconds / 60;
};

/**
 * Converts minutes to seconds.
 *
 * @param minutes - The number of minutes to convert
 * @returns The equivalent value in seconds
 *
 * @example
 * ```typescript
 * minutesToSeconds(1);   // 60
 * minutesToSeconds(2);   // 120
 * minutesToSeconds(0.5); // 30
 * ```
 */
export const minutesToSeconds = (minutes: number): number => {
  return minutes * 60;
};

/**
 * Converts seconds to hours.
 *
 * @param seconds - The number of seconds to convert
 * @returns The equivalent value in hours
 *
 * @example
 * ```typescript
 * secondsToHours(3600); // 1
 * secondsToHours(7200); // 2
 * secondsToHours(1800); // 0.5
 * ```
 */
export const secondsToHours = (seconds: number): number => {
  return seconds / 3600;
};

/**
 * Converts hours to seconds.
 *
 * @param hours - The number of hours to convert
 * @returns The equivalent value in seconds
 *
 * @example
 * ```typescript
 * hoursToSeconds(1);   // 3600
 * hoursToSeconds(2);   // 7200
 * hoursToSeconds(0.5); // 1800
 * ```
 */
export const hoursToSeconds = (hours: number): number => {
  return hours * 3600;
};

/**
 * Converts minutes to hours.
 *
 * @param minutes - The number of minutes to convert
 * @returns The equivalent value in hours
 *
 * @example
 * ```typescript
 * minutesToHours(60);  // 1
 * minutesToHours(120); // 2
 * minutesToHours(30);  // 0.5
 * ```
 */
export const minutesToHours = (minutes: number): number => {
  return minutes / 60;
};

/**
 * Converts hours to minutes.
 *
 * @param hours - The number of hours to convert
 * @returns The equivalent value in minutes
 *
 * @example
 * ```typescript
 * hoursToMinutes(1);   // 60
 * hoursToMinutes(2);   // 120
 * hoursToMinutes(0.5); // 30
 * ```
 */
export const hoursToMinutes = (hours: number): number => {
  return hours * 60;
};

/**
 * Converts milliseconds to seconds.
 *
 * @param milliseconds - The number of milliseconds to convert
 * @returns The equivalent value in seconds
 *
 * @example
 * ```typescript
 * millisecondsToSeconds(1000); // 1
 * millisecondsToSeconds(2000); // 2
 * millisecondsToSeconds(500);  // 0.5
 * ```
 */
export const millisecondsToSeconds = (milliseconds: number): number => {
  return milliseconds / 1000;
};

/**
 * Converts seconds to milliseconds.
 *
 * @param seconds - The number of seconds to convert
 * @returns The equivalent value in milliseconds
 *
 * @example
 * ```typescript
 * secondsToMilliseconds(1);   // 1000
 * secondsToMilliseconds(2);   // 2000
 * secondsToMilliseconds(0.5); // 500
 * ```
 */
export const secondsToMilliseconds = (seconds: number): number => {
  return seconds * 1000;
};

/** * Converts a file size in bytes to a human-readable string with appropriate units
 * using binary (base-2) conversion (1 KB = 1024 bytes).
 *
 * @param size - The file size in bytes to convert
 * @param locale - The locale string for formatting (e.g., 'en', 'fr')
 * @returns Formatted file size string (e.g., "1 KB", "5 MB")
 *
 * @example
 * ```typescript
 * bytesToFilesize(1024, 'en');        // "1 KB"
 * bytesToFilesize(1048576, 'en');     // "1 MB"
 * bytesToFilesize(5242880, 'fr');     // "5 Mo"
 * ```
 */
export function bytesToFilesize(size: number, locale: string): string {
  const symbols = locale.toLowerCase().startsWith('fr')
    ? {
        B: 'o', // octet
        KB: 'Ko', // kilooctet
        MB: 'Mo', // mégaoctet
        GB: 'Go', // gigaoctet
        TB: 'To', // téraoctet
        PB: 'Po', // pétaoctet
        EB: 'Eo', // exaoctet
        ZB: 'Zo', // zettaoctet
        YB: 'Yo', // yottaoctet
      }
    : undefined;
  return filesize(size, {
    base: 2,
    locale,
    standard: 'jedec',
    symbols,
    spacer: '\u00A0', // non-breaking space
  });
}
