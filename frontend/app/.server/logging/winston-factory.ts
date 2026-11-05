import path from 'node:path';
import type * as w from 'winston';
import winston, { format } from 'winston';

import type { LoggingConfig } from '~/.server/logging/logging-config';
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

  // Create and configure the main logger instance
  const winstonInstance = winston.createLogger({
    level: config.LOG_LEVEL,
    levels: levelsConfig.levels,
    format: format.combine(format.timestamp(), format.errors({ stack: true })),
    transports: [createConsoleTransport(config)],
    exitOnError: false,
  });

  // Configure audit logging if enabled
  configureAuditLogging(winstonInstance, config);

  winstonInstance.info('Logger initialized with level "%s"', winstonInstance.level);
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

    const logPath = path.join(dailyRotateFileTransport.dirname || '.', dailyRotateFileTransport.filename);
    logger.info(`Audit logging enabled. Writing logs to ${logPath}`);
  }
}
