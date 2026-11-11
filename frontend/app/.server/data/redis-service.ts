import { ATTR_DB_OPERATION_NAME } from '@opentelemetry/semantic-conventions';
import { injectable } from 'inversify';

import { getRedisClient } from '~/.server/data/redis-client';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';
import { ATTR_CDCP_CACHE_DELETED_COUNT, ATTR_CDCP_CACHE_HIT, ATTR_CDCP_CACHE_KEY, ATTR_CDCP_CACHE_TTL_SECONDS } from '~/.server/logging/log-attributes';
import { Traced } from '~/.server/observability/decorator';

/**
 * The RedisService is a service module for interacting with a Redis server. It
 * provides methods for getting, setting, and deleting values from Redis.
 *
 * @see https://redis.io/docs/connect/clients/nodejs/
 */
export interface RedisService {
  /**
   * @see https://redis.io/commands/get/
   */
  get: <T>(key: string) => Promise<T | null>;
  /**
   * @see https://redis.io/commands/set/
   */
  set: (key: string, value: unknown, ttlSecs: number) => Promise<'OK'>;
  /**
   * @see https://redis.io/commands/del/
   */
  del: (key: string) => Promise<number>;
  /**
   * @see https://redis.io/commands/ping/
   */
  ping: () => Promise<'PONG'>;
  /**
   * @see https://redis.io/commands/ttl/
   */
  ttl: (key: string) => Promise<number>;
}

@injectable()
export class DefaultRedisService implements RedisService {
  private readonly log: Logger;

  constructor() {
    this.log = createLogger('DefaultRedisService');
  }

  @Traced()
  async get<T>(key: string): Promise<T | null> {
    const redisClient = await getRedisClient();
    const value = await redisClient.get(key);
    this.log.debug('Redis GET completed', { [ATTR_DB_OPERATION_NAME]: 'GET', [ATTR_CDCP_CACHE_KEY]: key, [ATTR_CDCP_CACHE_HIT]: value !== null });
    return value ? JSON.parse(value) : null;
  }

  @Traced()
  async set(key: string, value: unknown, ttlSecs: number): Promise<'OK'> {
    const redisClient = await getRedisClient();
    const result = await redisClient.setEx(key, ttlSecs, JSON.stringify(value));
    this.log.debug('Redis SETEX completed', { [ATTR_DB_OPERATION_NAME]: 'SETEX', [ATTR_CDCP_CACHE_KEY]: key, [ATTR_CDCP_CACHE_TTL_SECONDS]: ttlSecs });
    return result;
  }

  @Traced()
  async del(key: string): Promise<number> {
    const redisClient = await getRedisClient();
    const result = await redisClient.del(key);
    this.log.debug('Redis DEL completed', { [ATTR_DB_OPERATION_NAME]: 'DEL', [ATTR_CDCP_CACHE_KEY]: key, [ATTR_CDCP_CACHE_DELETED_COUNT]: result });
    return result;
  }

  @Traced()
  async ping(): Promise<'PONG'> {
    const redisClient = await getRedisClient();
    await redisClient.ping();
    this.log.debug('Redis PING completed', { [ATTR_DB_OPERATION_NAME]: 'PING' });
    return 'PONG';
  }

  @Traced()
  async ttl(key: string): Promise<number> {
    const redisClient = await getRedisClient();
    const ttl = await redisClient.ttl(key);
    this.log.debug('Redis TTL completed', { [ATTR_DB_OPERATION_NAME]: 'TTL', [ATTR_CDCP_CACHE_KEY]: key, [ATTR_CDCP_CACHE_TTL_SECONDS]: ttl });
    return ttl;
  }
}
