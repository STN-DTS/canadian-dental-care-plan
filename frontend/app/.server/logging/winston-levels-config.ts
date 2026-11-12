import winston from 'winston';
import 'winston-daily-rotate-file';

import { winstonLogLevel } from '~/.server/logging/log-levels';
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
    levels: winstonLogLevel,
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
