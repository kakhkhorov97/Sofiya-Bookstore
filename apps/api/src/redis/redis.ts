import { Logger } from '@nestjs/common';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import {
  ThrottlerStorageService,
  type ThrottlerStorage,
} from '@nestjs/throttler';
import Redis from 'ioredis';
import type { ThrottlerStorageRecord } from '@nestjs/throttler/dist/throttler-storage-record.interface';

export const REDIS = Symbol('REDIS');

// Shared state for several API instances (Cloud Run scales out): rate
// limits and the daily AI cap. Optional: without REDIS_URL each instance
// keeps its own counts in memory, which is fine for one instance.
export function createRedis(url: string | undefined): Redis | null {
  if (!url) return null;
  const logger = new Logger('Redis');
  const redis = new Redis(url, {
    // Fail fast instead of queueing: callers fall back to memory.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 5_000,
    lazyConnect: false,
  });
  let down = false;
  redis.on('error', (err) => {
    if (!down)
      logger.warn(`Redis unavailable, using in-memory limits: ${err.message}`);
    down = true;
  });
  redis.on('ready', () => {
    if (down) logger.log('Redis is back');
    down = false;
  });
  return redis;
}

// Rate-limit storage in Redis that falls back to per-instance memory while
// Redis is unreachable, so an outage never blocks sign-in or Ask Sofiya.
export class FailOpenThrottlerStorage implements ThrottlerStorage {
  private readonly redisStorage: ThrottlerStorageRedisService;
  private readonly memory = new ThrottlerStorageService();

  constructor(private readonly redis: Redis) {
    this.redisStorage = new ThrottlerStorageRedisService(redis);
  }

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<ThrottlerStorageRecord> {
    if (this.redis.status === 'ready') {
      try {
        return await this.redisStorage.increment(
          key,
          ttl,
          limit,
          blockDuration,
          throttlerName,
        );
      } catch {
        // fall through to memory
      }
    }
    return this.memory.increment(key, ttl, limit, blockDuration, throttlerName);
  }
}
