import { invariant } from '@dts-stn/invariant';
import { createClient, createSentinel } from 'redis';
import type { RedisClientType, RedisSentinelType } from 'redis';

import type { ServerConfig } from '~/.server/configs';
import { createLogger } from '~/.server/logging';
import { getEnv } from '~/.server/utils/env.utils';
import { singleton } from '~/.server/utils/instance-registry';

export type RedisClient = RedisClientType | RedisSentinelType;

/**
 * Retrieves the singleton Redis client instance.
 * Chooses between standalone or sentinel configuration based on environment variables.
 * Ensures only one Redis client is created and reused throughout the application's lifecycle.
 *
 * @returns The connected Redis client instance.
 */
export async function getRedisClient(): Promise<RedisClient> {
  const log = createLogger('redis-client/getRedisClient');
  const client = singleton('redisClient', () => {
    const serverConfig = getEnv();

    if (serverConfig.REDIS_SENTINEL_NAME) {
      log.info('Using Redis Sentinel configuration');
      return createRedisSentinelClient(serverConfig);
    }

    log.info('Using standalone Redis configuration');
    return createRedisClient(serverConfig);
  });

  if (!client.isOpen) {
    log.debug('Connecting to Redis...');
    await client.connect();
    log.info('Redis client connected');
  }

  return client;
}

/**
 * Configuration required for a standalone Redis client.
 * Only the specified properties from ServerConfig are used.
 */
type RedisStandaloneClientServerConfig = Pick<
  ServerConfig,
  | 'REDIS_COMMAND_TIMEOUT_SECONDS' //
  | 'REDIS_STANDALONE_HOST'
  | 'REDIS_STANDALONE_PORT'
  | 'REDIS_USERNAME'
  | 'REDIS_PASSWORD'
>;

/**
 * Creates and configures a standalone Redis client with logging and reconnection strategy.
 *
 * @param config - Standalone Redis configuration.
 * @returns The configured Redis client instance.
 */
function createRedisClient(config: RedisStandaloneClientServerConfig): RedisClientType {
  const log = createLogger('redis-client/createRedisClient');
  log.info('Initializing standalone Redis client');

  const client = createClient({
    url: `redis://${config.REDIS_STANDALONE_HOST}:${config.REDIS_STANDALONE_PORT}`,
    username: config.REDIS_USERNAME,
    password: config.REDIS_PASSWORD,
    commandOptions: {
      timeout: config.REDIS_COMMAND_TIMEOUT_SECONDS * 1000,
    },
    socket: {
      reconnectStrategy: exponentialBackoffReconnectionStrategy,
    },
  });

  log.debug('Registering event handlers for standalone Redis client');
  client
    .on('connect', () => {
      log.info('Connecting to redis://%s:%s', config.REDIS_STANDALONE_HOST, config.REDIS_STANDALONE_PORT);
    })
    .on('ready', () => {
      log.info('Standalone Redis client is ready');
    })
    .on('reconnecting', () => {
      log.warn('Reconnecting to redis://%s:%s', config.REDIS_STANDALONE_HOST, config.REDIS_STANDALONE_PORT);
    })
    .on('error', (error: Error) => {
      log.error('Standalone Redis client error: %o', error);
    });

  return client as RedisClientType;
}

/**
 * Configuration required for a Redis Sentinel client.
 * Only the specified properties from ServerConfig are used.
 */
type RedisSentinelClientServerConfig = Pick<
  ServerConfig,
  'REDIS_COMMAND_TIMEOUT_SECONDS' | 'REDIS_SENTINEL_NAME' | 'REDIS_SENTINEL_HOST' | 'REDIS_SENTINEL_PORT' | 'REDIS_SENTINEL_USERNAME' | 'REDIS_SENTINEL_PASSWORD' | 'REDIS_USERNAME' | 'REDIS_PASSWORD'
>;

/**
 * Creates and configures a Redis Sentinel client with logging and reconnection strategy.
 * Validates required sentinel configuration values.
 *
 * @param config - Sentinel Redis configuration.
 * @returns The configured Redis Sentinel client instance.
 */
function createRedisSentinelClient(config: RedisSentinelClientServerConfig): RedisSentinelType {
  const log = createLogger('redis-client/createRedisSentinelClient');
  log.info('Initializing Redis Sentinel client');

  log.debug('Validating Redis Sentinel configuration');
  invariant(config.REDIS_SENTINEL_NAME, 'REDIS_SENTINEL_NAME must be defined');
  invariant(config.REDIS_SENTINEL_HOST, 'REDIS_SENTINEL_HOST must be defined');

  const sentinel = createSentinel({
    name: config.REDIS_SENTINEL_NAME,
    sentinelRootNodes: [
      {
        host: config.REDIS_SENTINEL_HOST,
        port: config.REDIS_SENTINEL_PORT,
      },
    ],
    sentinelClientOptions: {
      username: config.REDIS_SENTINEL_USERNAME,
      password: config.REDIS_SENTINEL_PASSWORD,
    },
    commandOptions: {
      timeout: config.REDIS_COMMAND_TIMEOUT_SECONDS * 1000,
    },
    nodeClientOptions: {
      username: config.REDIS_USERNAME,
      password: config.REDIS_PASSWORD,

      socket: {
        reconnectStrategy: exponentialBackoffReconnectionStrategy,
      },
    },
  });

  log.debug('Registering event handlers for Redis Sentinel client');
  sentinel
    .on('connect', () => {
      log.info('Connecting to redis-sentinel://%s:%s', config.REDIS_SENTINEL_HOST, config.REDIS_SENTINEL_PORT);
    })
    .on('ready', () => {
      log.info('Redis Sentinel client is ready');
    })
    .on('reconnecting', () => {
      log.warn('Reconnecting to redis-sentinel://%s:%s', config.REDIS_SENTINEL_HOST, config.REDIS_SENTINEL_PORT);
    })
    .on('error', (error: Error) => {
      log.error('Redis Sentinel client error: %o', error);
    });

  return sentinel as RedisSentinelType;
}

/**
 * Implements a custom exponential backoff reconnection strategy for Redis clients.
 * Adds random jitter to avoid thundering herd problems.
 *
 * @param retries - The number of consecutive failed connection attempts.
 * @param cause - The error that caused the reconnection attempt.
 * @returns The delay in milliseconds before the next reconnection attempt.
 *
 * @see https://github.com/redis/docs/blob/5e1b0aad58aedd24a7f93aba58502b4a27e67c32/content/develop/clients/nodejs/connect.md?plain=1#L312
 */
function exponentialBackoffReconnectionStrategy(retries: number, cause: Error): number {
  const log = createLogger('redis-client/reconnectionStrategy');
  // Generate a random jitter between 0 – 100 ms:
  const jitter = Math.floor(Math.random() * 100);

  // Delay is an exponential backoff, (2^retries) * 50 ms, with a
  // maximum value of 3000 ms:
  const delay = Math.min(Math.pow(2, retries) * 50, 3000);

  const retryIn = delay + jitter;
  log.error('Redis connection failed (attempt #%s); retrying in %s ms. Cause: %o', retries, retryIn, cause);
  return retryIn;
}
