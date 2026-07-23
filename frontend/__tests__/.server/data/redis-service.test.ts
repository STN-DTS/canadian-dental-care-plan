import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getRedisClient } from '~/.server/data/redis-client';
import { DefaultRedisService } from '~/.server/data/redis-service';

vi.mock('~/.server/data/redis-client');

describe('DefaultRedisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('get<T>', () => {
    it('should return correct parsed value', async () => {
      vi.mocked(getRedisClient, { partial: true }).mockResolvedValueOnce({
        get: async () => await Promise.resolve(JSON.stringify({ name: 'John Doe' })),
      });

      const redisService = new DefaultRedisService();
      const actual = await redisService.get<{ name: string }>('key');

      expect(actual).toEqual({ name: 'John Doe' });
    });

    it('should null if no value found', async () => {
      vi.mocked(getRedisClient, { partial: true }).mockResolvedValueOnce({
        get: async () => await Promise.resolve(null),
      });

      const redisService = new DefaultRedisService();
      const actual = await redisService.get<{ name: string }>('key');

      expect(actual).toEqual(null);
    });
  });

  describe('set', () => {
    it('should call redisClient.set() with stringified value', async () => {
      const setExMock = vi.fn();
      vi.mocked(getRedisClient, { partial: true }).mockResolvedValueOnce({
        setEx: setExMock,
      });

      const redisService = new DefaultRedisService();
      await redisService.set('key', { name: 'John Doe' }, 600);

      expect(setExMock).toHaveBeenCalledWith('key', 600, JSON.stringify({ name: 'John Doe' }));
    });
  });

  describe('del', () => {
    it('should call redisClient.del()', async () => {
      const delMock = vi.fn();
      vi.mocked(getRedisClient, { partial: true }).mockResolvedValueOnce({
        del: delMock,
      });

      const redisService = new DefaultRedisService();
      await redisService.del('key');
      expect(delMock).toHaveBeenCalledWith('key');
    });
  });

  describe('ttl', () => {
    it('should call redisClient.ttl()', async () => {
      const ttlMock = vi.fn();
      vi.mocked(getRedisClient, { partial: true }).mockResolvedValueOnce({
        ttl: ttlMock,
      });

      const redisService = new DefaultRedisService();

      await redisService.ttl('key');
      expect(ttlMock).toHaveBeenCalledWith('key');
    });
  });
});
