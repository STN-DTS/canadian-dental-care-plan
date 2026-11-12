import { SeverityNumber } from '@opentelemetry/api';

/**
 * Supported application log level names. `LogLevel` and `LOG_LEVEL` validation
 * derive from this tuple; Winston priority and telemetry severity use separate maps.
 */
export const logLevels = ['audit', 'error', 'warn', 'info', 'http', 'debug', 'trace'] as const;

/** Union of supported application log level names. */
export type LogLevel = (typeof logLevels)[number];

/**
 * Winston priority for each application log level. Numbers follow RFC 5424's
 * severity ordering: smaller values are more severe and have higher priority.
 * These are application-specific priorities, not RFC 5424 severity codes.
 *
 * Winston emits the configured level and all levels with numerically smaller
 * priorities. For example, `LOG_LEVEL=info` includes audit, error, warn and
 * info, but filters out http, debug and trace.
 */
export const winstonLogLevel = {
  trace: 6,
  debug: 5,
  http: 4,
  info: 3,
  audit: 2,
  warn: 1,
  error: 0,
} as const satisfies Record<LogLevel, number>;

/**
 * OpenTelemetry `SeverityNumber` used when exporting each application log level.
 *
 * This mapping is independent of Winston priorities: `http` uses `DEBUG4` (8),
 * while `audit` and `info` both use `INFO` (9).
 */
export const otelSeverityNumberMapping = {
  trace: SeverityNumber.TRACE,
  debug: SeverityNumber.DEBUG,
  http: SeverityNumber.DEBUG4,
  info: SeverityNumber.INFO,
  audit: SeverityNumber.INFO,
  warn: SeverityNumber.WARN,
  error: SeverityNumber.ERROR,
} as const satisfies Record<LogLevel, SeverityNumber>;

/**
 * Dynatrace's normalized `loglevel` labels.
 * See the [log data transformation docs](https://docs.dynatrace.com/docs/analyze-explore-automate/logs/lma-log-ingestion/lma-log-ingestion-via-oa/lma-log-data-transformation-oa).
 */
export type DynatraceLogLevel = 'SEVERE' | 'ERROR' | 'CRITICAL' | 'ALERT' | 'FATAL' | 'EMERGENCY' | 'WARN' | 'INFO' | 'TRACE' | 'DEBUG' | 'NOTICE' | 'NONE';

/**
 * Normalized Dynatrace `loglevel` label for each application log level.
 * `http` maps to `DEBUG`, `audit` maps to `INFO`, and the other levels retain
 * their corresponding Dynatrace labels.
 */
export const dynatraceLogLevelMapping = {
  trace: 'TRACE',
  debug: 'DEBUG',
  http: 'DEBUG',
  info: 'INFO',
  audit: 'INFO',
  warn: 'WARN',
  error: 'ERROR',
} as const satisfies Record<LogLevel, DynatraceLogLevel>;

/** Longest configured level name, used to align formatted log output. */
export const maxLogLevelNameLength = Math.max(...logLevels.map((level) => level.length));
