import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import type Redis from 'ioredis';
import { loadEnv } from '../config/env';
import {
  DAILY_COUNTER,
  MemoryDailyCounter,
  RedisDailyCounter,
} from './daily-counter';
import { createRedis, FailOpenThrottlerStorage, REDIS } from './redis';

@Global()
@Module({
  providers: [
    { provide: REDIS, useFactory: () => createRedis(loadEnv().REDIS_URL) },
    {
      provide: DAILY_COUNTER,
      inject: [REDIS],
      useFactory: (redis: Redis | null) =>
        redis ? new RedisDailyCounter(redis) : new MemoryDailyCounter(),
    },
  ],
  exports: [REDIS, DAILY_COUNTER],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis | null) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis?.quit().catch(() => undefined);
  }
}

// Every module that rate-limits imports this: limits live in Redis when
// REDIS_URL is set (shared by all instances), otherwise in memory.
export const throttlerModule = () =>
  ThrottlerModule.forRootAsync({
    inject: [REDIS],
    useFactory: (redis: Redis | null) => ({
      throttlers: [{ ttl: 60_000, limit: 60 }],
      storage: redis ? new FailOpenThrottlerStorage(redis) : undefined,
    }),
  });
