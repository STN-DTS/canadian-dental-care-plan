import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { infoMock, errorMock } = vi.hoisted(() => ({
  infoMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('~/.server/logging', () => ({
  createLogger: vi.fn(() => ({
    info: infoMock,
    error: errorMock,
  })),
}));

import { configureGracefulShutdown } from '~/.server/express-server/shutdown';
import type { ShutdownProcess } from '~/.server/express-server/shutdown';

function createFakeProcess() {
  const emitter = new EventEmitter();
  const exit = vi.fn();
  const processRef: ShutdownProcess = {
    once: emitter.once.bind(emitter),
    off: emitter.off.bind(emitter),
    exit,
    exitCode: undefined,
  };
  return { emitter, exit, processRef };
}

describe('configureGracefulShutdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('closes the HTTP server, runs onShutdown, and lets the event loop drain naturally without calling process.exit', async () => {
    const { emitter, exit, processRef } = createFakeProcess();
    const onShutdown = vi.fn(async () => {
      await Promise.resolve();
    });
    const server = {
      close: vi.fn((cb?: (error?: Error) => void) => {
        cb?.();
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };

    configureGracefulShutdown(server, { onShutdown, processRef });
    emitter.emit('SIGTERM');
    await vi.waitFor(() => {
      expect(onShutdown).toHaveBeenCalledTimes(1);
    });

    expect(server.close).toHaveBeenCalledTimes(1);
    expect(server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(server.closeAllConnections).not.toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
    expect(processRef.exitCode).toBeUndefined();
    expect(emitter.listenerCount('SIGTERM')).toBe(0);
    expect(emitter.listenerCount('SIGINT')).toBe(0);
  });

  it('ignores subsequent signals while shutdown is already in progress', async () => {
    const { emitter, processRef } = createFakeProcess();
    let finishClose: (() => void) | undefined;
    const onShutdown = vi.fn(async () => {
      await Promise.resolve();
    });
    const server = {
      close: vi.fn((cb?: (error?: Error) => void) => {
        finishClose = () => cb?.();
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };

    configureGracefulShutdown(server, { onShutdown, processRef });
    emitter.emit('SIGTERM');
    emitter.emit('SIGINT');
    finishClose?.();

    await vi.waitFor(() => {
      expect(onShutdown).toHaveBeenCalledTimes(1);
    });
    expect(server.close).toHaveBeenCalledTimes(1);
  });

  it('still runs onShutdown and sets exitCode=1 when server.close fails', async () => {
    const { emitter, exit, processRef } = createFakeProcess();
    const closeError = Object.assign(new Error('Server is not running'), { code: 'ERR_SERVER_NOT_RUNNING' });
    const onShutdown = vi.fn(async () => {
      await Promise.resolve();
    });
    const server = {
      close: vi.fn((cb?: (error?: Error) => void) => {
        cb?.(closeError);
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };

    configureGracefulShutdown(server, { onShutdown, processRef });
    emitter.emit('SIGTERM');

    await vi.waitFor(() => {
      expect(processRef.exitCode).toBe(1);
    });

    expect(onShutdown).toHaveBeenCalledTimes(1);
    expect(errorMock).toHaveBeenCalledWith(closeError, {
      'error.type': 'Error',
    });
    expect(exit).not.toHaveBeenCalled();
  });

  it('logs admitted operational error codes and sets exitCode=1 when onShutdown rejects', async () => {
    const { emitter, exit, processRef } = createFakeProcess();
    const redisError = Object.assign(new Error('Connection reset'), { code: 'ECONNRESET' });
    const onShutdown = vi.fn(async () => {
      await Promise.reject(redisError);
    });
    const server = {
      close: vi.fn((cb?: (error?: Error) => void) => {
        cb?.();
      }),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };

    configureGracefulShutdown(server, { onShutdown, processRef });
    emitter.emit('SIGTERM');

    await vi.waitFor(() => {
      expect(processRef.exitCode).toBe(1);
    });

    expect(errorMock).toHaveBeenCalledWith(redisError, {
      'error.type': 'Error',
      'cdcp.error.code': 'ECONNRESET',
    });
    expect(exit).not.toHaveBeenCalled();
  });

  it('forces connection closure and exits with code 1 when shutdown exceeds timeoutMs', () => {
    const { emitter, exit, processRef } = createFakeProcess();
    const server = {
      close: vi.fn(),
      closeIdleConnections: vi.fn(),
      closeAllConnections: vi.fn(),
    };

    configureGracefulShutdown(server, { timeoutMs: 5000, processRef });
    emitter.emit('SIGTERM');

    vi.advanceTimersByTime(5000);

    expect(errorMock).toHaveBeenCalledWith('Graceful shutdown timed out; forcing exit', { 'error.type': 'shutdown_timeout' });
    expect(server.closeAllConnections).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
