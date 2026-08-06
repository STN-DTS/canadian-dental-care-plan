/**
 * Log levels supported by the OpenTelemetry bootstrap logger.
 */
type OpenTelemetryLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Options controlling logger output.
 */
interface OpenTelemetryLoggerOptions {
  /**
   * Whether debug messages should be written. Defaults to non-production environments.
   */
  showDebug?: boolean;
}

/**
 * Writes timestamped OpenTelemetry bootstrap messages to process output streams.
 */
class OpenTelemetryLogger {
  private readonly label: string;
  private readonly showDebug: boolean;

  constructor(label: string, options: OpenTelemetryLoggerOptions = {}) {
    this.label = label;

    // Enable debug output outside production unless caller explicitly overrides it.
    this.showDebug = options.showDebug ?? process.env.NODE_ENV !== 'production';
  }

  private _getTimestamp(): string {
    return new Date().toISOString();
  }

  private _print(level: OpenTelemetryLogLevel, message: string, ...args: unknown[]): void {
    if (level === 'DEBUG' && !this.showDebug) return;

    const timestamp = this._getTimestamp();
    const plainMsg = `[${timestamp}] [${level}] [${this.label}] ${message}`;

    // Use stdout for debug/info and stderr for warnings/errors so collectors can classify severity.
    if (level === 'ERROR') {
      console.error(plainMsg, ...args);
    } else if (level === 'WARN') {
      console.warn(plainMsg, ...args);
    } else {
      console.log(plainMsg, ...args);
    }
  }

  /**
   * Writes debug output when debug logging is enabled.
   */
  public debug(msg: string, ...args: unknown[]): void {
    this._print('DEBUG', msg, ...args);
  }

  /**
   * Writes informational output.
   */
  public info(msg: string, ...args: unknown[]): void {
    this._print('INFO', msg, ...args);
  }

  /**
   * Writes warning output.
   */
  public warn(msg: string, ...args: unknown[]): void {
    this._print('WARN', msg, ...args);
  }

  /**
   * Writes error output.
   */
  public error(msg: string, ...args: unknown[]): void {
    this._print('ERROR', msg, ...args);
  }
}

/**
 * Creates a logger for messages emitted during OpenTelemetry initialization and shutdown.
 */
export function createOpenTelemetryLogger(label: string, options: OpenTelemetryLoggerOptions = {}): OpenTelemetryLogger {
  return new OpenTelemetryLogger(label, options);
}
