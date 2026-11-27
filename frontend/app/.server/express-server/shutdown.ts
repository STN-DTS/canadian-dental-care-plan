import { ATTR_ERROR_TYPE } from '@opentelemetry/semantic-conventions';

import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_ERROR_CODE } from '~/.server/logging/log-attributes';
import { operationalErrorCode, operationalErrorType } from '~/instrumentation/operational-error-type';

const DEFAULT_SHUTDOWN_TIMEOUT_MS = 15_000;

export interface ShutdownServer {
  close(callback?: (error?: Error) => void): unknown;
  closeIdleConnections(): void;
  closeAllConnections(): void;
}

export interface ShutdownProcess {
  once(event: NodeJS.Signals, listener: () => void): unknown;
  off(event: NodeJS.Signals, listener: () => void): unknown;
  exit(code?: number): unknown;
  exitCode?: number | string | null;
}

export interface ConfigureGracefulShutdownOptions {
  /**
   * Optional async cleanup hook run after the HTTP server stops accepting connections
   * (for example, closing the shared Redis client).
   */
  onShutdown?: () => Promise<void>;
  /**
   * Maximum time to wait for graceful drain and exit before forcing termination.
   * Defaults to 15 seconds to leave headroom before Kubernetes sends SIGKILL.
   */
  timeoutMs?: number;
  /** Process-like target for signal registration and exit handling (injectable for tests). */
  processRef?: ShutdownProcess;
}

/**
 * Registers SIGTERM and SIGINT handlers that stop accepting new HTTP connections,
 * close idle keep-alive sockets, run `onShutdown`, and let the event loop drain
 * naturally so `beforeExit` hooks (such as OpenTelemetry SDK shutdown) can flush.
 *
 * Keeps an unref'd timeout armed so a stuck drain or telemetry flush forces exit
 * before Kubernetes sends SIGKILL without ever delaying a clean exit.
 */
export function configureGracefulShutdown(server: ShutdownServer, options: ConfigureGracefulShutdownOptions = {}): () => void {
  const { onShutdown, timeoutMs = DEFAULT_SHUTDOWN_TIMEOUT_MS, processRef = process } = options;
  const log = createLogger('express/shutdown');

  let shuttingDown = false;

  const logError = (error: unknown) => {
    const code = operationalErrorCode(error);
    log.error(error, {
      [ATTR_ERROR_TYPE]: operationalErrorType(error),
      ...(code && { [ATTR_CDCP_ERROR_CODE]: code }),
    });
  };

  const handleSignal = () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    dispose();
    log.info('Received shutdown signal; closing server');

    // Kept unref'd so a clean drain exits naturally (triggering `beforeExit` for OTel flush),
    // while still forcing exit if draining or flushing hangs past the deadline.
    const forceExitTimer = setTimeout(() => {
      log.error('Graceful shutdown timed out; forcing exit', { [ATTR_ERROR_TYPE]: 'shutdown_timeout' });
      server.closeAllConnections();
      processRef.exit(1);
    }, timeoutMs);
    forceExitTimer.unref();

    void (async () => {
      let failed = false;

      try {
        await new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
          server.closeIdleConnections();
        });
        log.info('HTTP server closed');
      } catch (error) {
        failed = true;
        logError(error);
      }

      if (onShutdown) {
        try {
          await onShutdown();
        } catch (error) {
          failed = true;
          logError(error);
        }
      }

      if (failed) {
        processRef.exitCode = 1;
      }
    })();
  };

  const dispose = () => {
    processRef.off('SIGTERM', handleSignal);
    processRef.off('SIGINT', handleSignal);
  };

  processRef.once('SIGTERM', handleSignal);
  processRef.once('SIGINT', handleSignal);

  return dispose;
}
