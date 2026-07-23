import { injectable } from 'inversify';

import { getRedisClient } from '~/.server/data/redis-client';
import type { Logger } from '~/.server/logging';
import { createLogger } from '~/.server/logging';

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

  async get<T>(key: string): Promise<T | null> {
    const redisClient = await getRedisClient();
    const value = await redisClient.get(key);
    this.log.debug('GET key=[%s] hit=[%s]', key, value);
    return value ? JSON.parse(value) : null;
  }

  async set(key: string, value: unknown, ttlSecs: number): Promise<'OK'> {
    const redisClient = await getRedisClient();
    const result = await redisClient.setEx(key, ttlSecs, JSON.stringify(value));
    this.log.debug('SET key=[%s] ttl=[%s]', key, ttlSecs);
    return result;
  }

  async del(key: string): Promise<number> {
    const redisClient = await getRedisClient();
    const result = await redisClient.del(key);
    this.log.debug('DEL key=[%s] result=[%s]', key, result);
    return result;
  }

  async ping(): Promise<'PONG'> {
    const redisClient = await getRedisClient();
    await redisClient.ping();
    this.log.debug('PING successful');
    return 'PONG';
  }

  async ttl(key: string): Promise<number> {
    const redisClient = await getRedisClient();
    const ttl = await redisClient.ttl(key);
    this.log.debug('TTL key=[%s] ttl=[%s]', key, ttl);
    return ttl;
  }
}
