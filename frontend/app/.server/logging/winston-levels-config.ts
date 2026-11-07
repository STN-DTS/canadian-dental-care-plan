import winston from 'winston';
import 'winston-daily-rotate-file';

import type { LogLevel } from '~/.server/logging/log-levels';
import type { LoggingConfig } from '~/.server/logging/logging-config';

type LevelsConfig = {
  levels: Record<LogLevel, number>;
  colors: Record<LogLevel, string>;
};

let levelsConfig: LevelsConfig | undefined;

/**
 * Winston logging configuration.
 *
 * Winston treats lower numeric values as higher-priority log levels. A logger
 * configured with a level emits that level and every level with a lower value.
 * For example, `LOG_LEVEL=info` emits `audit`, `error`, `warn`, and `info`, but not `http`.
 * Colors map each custom level to Winston's colorize formatter.
 */
export function getLevelsConfig(config: LoggingConfig): LevelsConfig {
  if (levelsConfig) {
    return levelsConfig;
  }

  levelsConfig = {
    levels: {
      audit: 0, // Highest priority - for security and compliance events
      error: 1, // Application errors requiring immediate attention
      warn: 2, // Warning conditions
      info: 3, // Informational messages
      http: 4, // Verbose successful HTTP request completion
      debug: 5, // Detailed debug information
      trace: 6, // Fine-grained debug information
    },
    colors: {
      audit: 'grey',
      error: 'red',
      warn: 'yellow',
      info: 'green',
      http: 'green',
      debug: 'blue',
      trace: 'magenta',
    },
  } as const satisfies LevelsConfig;

  // Validate that LOG_LEVEL is valid before creating the logger
  if (!Object.hasOwn(levelsConfig.levels, config.LOG_LEVEL)) {
    throw new Error(`Invalid LOG_LEVEL: ${config.LOG_LEVEL}`);
  }

  winston.addColors(levelsConfig.colors);

  return levelsConfig;
}
