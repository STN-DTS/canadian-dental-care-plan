import * as z from 'zod';

import { logLevels } from '~/.server/logging/log-levels';
import type { LogLevel } from '~/.server/logging/log-levels';
import { singleton } from '~/.server/utils/instance-registry';

/**
 * Type definition for the application's logging configuration parameters.
 * This configuration controls log levels, audit logging behavior, and file paths.
 */
export type LoggingConfig = {
  /**
   * The minimum log level to output (from most to least severe: audit, error, warn, http, info, debug, trace).
   * Messages below this level will be filtered out.
   */
  LOG_LEVEL: LogLevel;

  /**
   * Whether to enable separate audit logging for security and compliance purposes.
   * When true, audit logs will be written to separate files for easier tracking.
   */
  AUDIT_LOG_ENABLED: boolean;

  /**
   * Directory path where audit logs will be stored.
   * Must be a valid directory path that the application has write permissions for.
   */
  AUDIT_LOG_DIRNAME: string;

  /**
   * Filename pattern for audit logs.
   * The placeholder %DATE% will be replaced with the current date (format: YYYY-MM-DD).
   */
  AUDIT_LOG_FILENAME: string;
};

/**
 * Default configuration values used when specific settings are not provided in the environment.
 * These values serve as fallbacks if environment variables are missing or invalid.
 *
 * The LOG_LEVEL defaults are environment-aware:
 * - 'http' in production (less verbose, better performance)
 * - 'debug' in development (more verbose for troubleshooting)
 */
export const defaultsConfig = {
  LOG_LEVEL: process.env.NODE_ENV === 'production' ? 'http' : 'debug',
  AUDIT_LOG_ENABLED: true,
  AUDIT_LOG_DIRNAME: 'logs',
  AUDIT_LOG_FILENAME: 'audit-%DATE%',
} as const satisfies LoggingConfig;

/**
 * Zod schema for validating and parsing logging-related environment variables.
 * This schema enforces type constraints and provides intelligent fallbacks to
 * ensure the application always has valid logging configuration.
 */
const loggingConfigSchema = z.object({
  LOG_LEVEL: z
    .enum(logLevels) // Ensures the log level is one of the predefined levels
    .default(defaultsConfig.LOG_LEVEL),

  AUDIT_LOG_ENABLED: z
    .string() // Validates AUDIT_LOG_ENABLED as a string
    .transform((val) => val.toLowerCase() === 'true') // Converts to boolean
    .default(defaultsConfig.AUDIT_LOG_ENABLED),

  AUDIT_LOG_DIRNAME: z
    .string() //
    .trim()
    .min(1, 'Audit log directory name cannot be empty.')
    .default(defaultsConfig.AUDIT_LOG_DIRNAME),

  AUDIT_LOG_FILENAME: z
    .string() //
    .trim()
    .min(1, 'Audit log file name pattern cannot be empty.')
    .default(defaultsConfig.AUDIT_LOG_FILENAME),
});

/**
 * Retrieves and validates logging configuration from environment variables.
 *
 * This function uses the singleton pattern to ensure the configuration is parsed
 * only once per application lifecycle, improving performance and consistency.
 *
 * @example
 * ```typescript
 * const config = getLoggingConfig();
 * console.log(`Current log level: ${config.LOG_LEVEL}`);
 * ```
 * @returns The validated logging configuration object with all required fields
 */
export function getLoggingConfig(): LoggingConfig {
  return singleton('loggingConfig', () => {
    // Parse environment variables, applying validation rules
    // The singleton ensures we only validate once per application instance
    return loggingConfigSchema.parse(process.env);
  });
}
