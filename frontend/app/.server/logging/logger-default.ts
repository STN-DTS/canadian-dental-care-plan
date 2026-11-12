import { LEVEL, SPLAT } from 'triple-beam';
import type winston from 'winston';

import type { LogLevel } from '~/.server/logging/log-levels';
import type { Logger } from '~/.server/logging/logger';

interface LogEntry {
  label: string;
  level: string;
  message: string;
  [LEVEL]: string;
  [SPLAT]?: unknown;
  [key: string | symbol]: unknown;
}

/**
 * Implements the Logger interface using the Winston logging library.
 * This class wraps Winston to provide structured logging with support for different log levels.
 */
export class DefaultLogger implements Logger {
  private readonly logger: winston.Logger;
  private readonly label: string;

  /**
   * Creates an instance of DefaultLogger.
   * This logger instance will be configured with the provided `label` to prefix each log entry,
   * ensuring that logs are properly categorized based on the service or context.
   *
   * @param logger - A pre-configured Winston Logger instance to use for logging.
   * @param label - The label for the logger (e.g., 'auth', 'db'). This will be included in all log entries.
   * @throws {Error} If the provided label is empty or consists only of whitespace.
   */
  constructor(logger: winston.Logger, label: string) {
    this.logger = logger; // Use the provided Winston logger instance.
    this.label = label.trim(); // Ensure the label is clean and trimmed.
  }

  // Various logging methods, each corresponding to a specific log level.
  audit(message: unknown): void;
  audit(message: unknown, ...meta: unknown[]): void {
    this.logInternal('audit', message, meta);
  }

  debug(message: unknown): void;
  debug(message: unknown, ...meta: unknown[]): void {
    this.logInternal('debug', message, meta);
  }

  error(message: unknown): void;
  error(message: unknown, ...meta: unknown[]): void {
    this.logInternal('error', message, meta);
  }

  http(message: unknown): void;
  http(message: unknown, ...meta: unknown[]): void {
    this.logInternal('http', message, meta);
  }

  info(message: unknown): void;
  info(message: unknown, ...meta: unknown[]): void {
    this.logInternal('info', message, meta);
  }

  trace(message: unknown): void;
  trace(message: unknown, ...meta: unknown[]): void {
    this.logInternal('trace', message, meta);
  }

  warn(message: unknown): void;
  warn(message: unknown, ...meta: unknown[]): void {
    this.logInternal('warn', message, meta);
  }

  /**
   * Internal log method that handles the actual logging process.
   * This method processes the level, message, and any additional meta data before passing it to Winston.
   *
   * @param level - The log level (e.g., 'info', 'warn', 'error').
   * @param messageOrObject - The message to be logged, an Error, or an object containing additional data.
   * @param splat - Additional arguments to be logged. After an Error or a message without format
   * specifiers, the first object is merged into the entry as structured metadata.
   */
  private logInternal(level: LogLevel, messageOrObject: unknown, splat: unknown[]): void {
    const baseEntry = {
      level: level,
      [LEVEL]: level, // Attach the log level as the symbol.
      label: this.label, // Attach the logger label.
    } as const satisfies OmitStrict<LogEntry, 'message'>;

    // Scenario 0: Logging an Error, optionally followed by a metadata object.
    // logform's errors format only reads an Error that is the info itself or `info.message`;
    // a fresh entry keeps the caller's Error unmodified.
    if (messageOrObject instanceof Error) {
      const metadata = typeof splat[0] === 'object' && splat[0] !== null ? splat[0] : {};
      const entry = Object.assign({}, metadata, baseEntry, { message: messageOrObject });
      // @ts-expect-error: Winston's type requires a string `message`; the errors format replaces this Error with its message and stack.
      this.logger.log(entry);
      return;
    }

    // Scenario 1: Logging with an object (messageOrObject is an object)
    if (splat.length === 0 && typeof messageOrObject === 'object' && messageOrObject !== null && !Array.isArray(messageOrObject)) {
      const entry = Object.assign(messageOrObject, baseEntry); // Merge object and base entry.
      // Object-style entries may omit `message`; Winston logs their structured fields directly.
      // @ts-ignore: Winston's type requires `message`, but this object-style entry is valid at runtime.
      this.logger.log(entry); // Log the merged entry.
      return;
    }

    // Scenario 2: Standard message logging with no splat args.
    const msg = String(messageOrObject); // Ensure message is a string.

    if (splat.length === 0) {
      // Merge baseEntry with message.
      const entry: LogEntry = Object.assign(baseEntry, { message: msg });
      this.logger.log(entry);
      return;
    }

    // Scenario 3: Logging with message formatting and splat args (e.g., 'User %s logged in').
    const formatRegExp = /%[scdjifoO%]/g; // Regex for detecting format specifiers like %s, %d.
    const tokens = msg.match(formatRegExp); // Find all tokens.

    if (!tokens && splat[0] !== null && typeof splat[0] === 'object') {
      const entry: LogEntry = Object.assign({}, splat[0], baseEntry, { message: msg });
      this.logger.log(entry);
      return;
    }

    // Scenario 4: Logging with splat args for more complex messages.
    const entry: LogEntry = Object.assign(baseEntry, { message: msg, [SPLAT]: splat });
    this.logger.log(entry);
  }
}
