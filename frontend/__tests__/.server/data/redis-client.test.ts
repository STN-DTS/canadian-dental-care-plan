import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock, createSentinelMock, infoMock, debugMock, errorMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSentinelMock: vi.fn(),
  infoMock: vi.fn(),
  debugMock: vi.fn(),
  errorMock: vi.fn(),
}));

vi.mock('redis', () => ({
  createClient: createClientMock,
  createSentinel: createSentinelMock,
}));

vi.mock('~/.server/logging', () => ({
  createLogger: vi.fn(() => ({
    info: infoMock,
    debug: debugMock,
    error: errorMock,
  })),
}));

vi.mock('~/.server/utils/env-utils', () => ({
  getEnv: vi.fn(),
}));

import { closeRedisClient, getRedisClient } from '~/.server/data/redis-client';
import { getEnv } from '~/.server/utils/env-utils';
import { deleteSingleton, hasSingleton } from '~/.server/utils/instance-registry';

function createFakeClient() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    isOpen: false,
    connect: vi.fn(async function (this: { isOpen: boolean }) {
      this.isOpen = true;
      await Promise.resolve();
    }),
    close: vi.fn(async function (this: { isOpen: boolean }) {
      this.isOpen = false;
      await Promise.resolve();
    }),
  });
}

describe('redis-client', () => {
  beforeEach(() => {
    deleteSingleton('redisClient');
    vi.clearAllMocks();
  });

  afterEach(() => {
    deleteSingleton('redisClient');
  });

  it('configures Sentinel with passthroughClientErrorEvents and logs topology-change events', async () => {
    const fakeSentinel = createFakeClient();
    createSentinelMock.mockReturnValue(fakeSentinel);
    vi.mocked(getEnv, { partial: true }).mockReturnValue({
      REDIS_SENTINEL_NAME: 'myprimary',
      REDIS_SENTINEL_HOST: 'redis-dev',
      REDIS_SENTINEL_PORT: 26_379,
      REDIS_COMMAND_TIMEOUT_SECONDS: 5,
    });

    await getRedisClient();

    expect(createSentinelMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'myprimary',
        scanInterval: 10_000,
        passthroughClientErrorEvents: true,
        commandOptions: { timeout: 5000 },
      }),
    );

    fakeSentinel.emit('topology-change', {
      type: 'MASTER_CHANGE',
      node: { host: 'redis-dev-1.redis-headless-dev', port: 6379 },
    });

    expect(infoMock).toHaveBeenCalledWith('Redis Sentinel primary changed', {
      'server.address': 'redis-dev-1.redis-headless-dev',
      'server.port': 6379,
    });
  });

  it('closes an open Redis client and clears the singleton registry', async () => {
    const fakeSentinel = createFakeClient();
    createSentinelMock.mockReturnValue(fakeSentinel);
    vi.mocked(getEnv, { partial: true }).mockReturnValue({
      REDIS_SENTINEL_NAME: 'myprimary',
      REDIS_SENTINEL_HOST: 'redis-dev',
      REDIS_SENTINEL_PORT: 26_379,
      REDIS_COMMAND_TIMEOUT_SECONDS: 5,
    });

    await getRedisClient();
    expect(hasSingleton('redisClient')).toBe(true);
    expect(fakeSentinel.isOpen).toBe(true);

    await closeRedisClient();

    expect(fakeSentinel.close).toHaveBeenCalledTimes(1);
    expect(hasSingleton('redisClient')).toBe(false);
  });

  it('is a no-op when closeRedisClient is called before any client is created', async () => {
    await expect(closeRedisClient()).resolves.toBeUndefined();
    expect(hasSingleton('redisClient')).toBe(false);
  });
});
