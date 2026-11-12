import os from 'node:os';
import type * as w from 'winston';
import { format, transports } from 'winston';
import 'winston-daily-rotate-file';
import type DailyRotateFile from 'winston-daily-rotate-file';

import type { LoggingConfig } from '~/.server/logging/logging-config';
import { formatLabels, formatLevels, formatPrintf } from '~/.server/logging/winston-format';
import { getLevelsConfig } from '~/.server/logging/winston-levels-config';

/**
 * Creates and configures the console transport for Winston based on the environment.
 *
 * @returns Configured console transport instance
 */
export function createConsoleTransport(config: LoggingConfig): w.transports.ConsoleTransportInstance {
  // Dev format for non-production environments
  let consoleFormat = format.combine(
    // Development format: colorized output with timestamp, and meta information
    formatLevels(),
    formatLabels(),
    format.colorize({
      all: false,
      message: false,
      level: true,
      ...getLevelsConfig(config),
    }), //
    formatPrintf(),
  );

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    consoleFormat = format.json();
  }

  return new transports.Console({
    handleExceptions: true, // Log uncaught exceptions
    handleRejections: true, // Log unhandled promise rejections
    format: consoleFormat,
  });
}

/**
 * Creates and configures a daily rotating file transport for audit logs.
 *
 * @param config - The logging configuration
 * @returns Configured DailyRotateFile transport instance
 */
export function createDailyRotateFileTransport(config: LoggingConfig): DailyRotateFile {
  return new transports.DailyRotateFile({
    level: 'audit',
    dirname: config.AUDIT_LOG_DIRNAME,
    filename: config.AUDIT_LOG_FILENAME,
    format: format.json(),
    extension: `_${os.hostname()}.log`,
    utc: true,
  });
}
