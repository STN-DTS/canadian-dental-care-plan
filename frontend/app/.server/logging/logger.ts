/**
 * Defines the standard logging methods, allowing logging at various severity levels.
 * Each method accepts a message and optional metadata for structured logging.
 *
 * The severity levels include:
 * - `audit`: Critical system events requiring persistence.
 * - `error`: Runtime errors that may require immediate attention.
 * - `warn`: Warnings for potential issues that don't halt execution.
 * - `info`: General system information.
 * - `debug`: Detailed logs useful during development.
 * - `trace`: Highly detailed tracing for diagnostics.
 */
export interface Logger {
  audit: LeveledLogMethod;
  debug: LeveledLogMethod;
  error: LeveledLogMethod;
  info: LeveledLogMethod;
  trace: LeveledLogMethod;
  warn: LeveledLogMethod;
}

/**
 * Method signature for logging messages at different levels of severity.
 *
 * The method can accept:
 * - A single `message` (string or any other type).
 * - An optional spread of `meta` data (usually structured logging info).
 *
 * The method signature accommodates different logging scenarios:
 * - Simple string messages.
 * - More complex messages with metadata for structured logging.
 */
interface LeveledLogMethod {
  (message: string, ...meta: unknown[]): void;
  (message: unknown): void;
}
