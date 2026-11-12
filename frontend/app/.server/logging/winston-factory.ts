import path from 'node:path';
import type * as w from 'winston';
import winston, { format } from 'winston';

import { ATTR_CDCP_LOG_AUDIT_FILE_PATH, ATTR_CDCP_LOG_LEVEL } from '~/.server/logging/log-attributes';
import type { LoggingConfig } from '~/.server/logging/logging-config';
import { addDynatraceLogLevel, addOtelSeverity, formatUrlPaths } from '~/.server/logging/winston-format';
import 'winston-daily-rotate-file';

import { getLevelsConfig } from '~/.server/logging/winston-levels-config';
import { createConsoleTransport, createDailyRotateFileTransport } from '~/.server/logging/winston-transport-factory';

/**
 * Creates a configured Winston logger instance based on the provided environment settings.
 *
 * @param config - The logging environment configuration containing settings like log level
 *                and audit log parameters.
 * @returns A configured Winston logger instance.
 */
export function createWinstonInstance(config: LoggingConfig): w.Logger {
  const levelsConfig = getLevelsConfig(config);

  // Severity fields only serve production log backends; they are noise in local console output.
  const severityFormats = process.env.NODE_ENV === 'production' ? [addDynatraceLogLevel(), addOtelSeverity()] : [];

  // Create and configure the main logger instance
  const winstonInstance = winston.createLogger({
    level: config.LOG_LEVEL,
    levels: levelsConfig.levels,
    format: format.combine(format.timestamp(), format.errors({ stack: true, cause: true }), ...severityFormats, formatUrlPaths()),
    transports: [createConsoleTransport(config)],
    exitOnError: false,
  });

  // Configure audit logging if enabled
  configureAuditLogging(winstonInstance, config);

  winstonInstance.info('Logger initialized', { [ATTR_CDCP_LOG_LEVEL]: winstonInstance.level });
  return winstonInstance;
}

/**
 * Configures and adds audit logging if enabled in the configuration.
 *
 * @param logger - The Winston logger instance
 * @param config - The logging configuration
 */
function configureAuditLogging(logger: w.Logger, config: LoggingConfig): void {
  if (config.AUDIT_LOG_ENABLED) {
    const dailyRotateFileTransport = createDailyRotateFileTransport(config);
    logger.add(dailyRotateFileTransport);

    logger.info('Audit logging enabled', { [ATTR_CDCP_LOG_AUDIT_FILE_PATH]: path.join(dailyRotateFileTransport.dirname || '.', dailyRotateFileTransport.filename) });
  }
}
