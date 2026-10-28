import { Logger } from '@nestjs/common';
import type Redis from 'ioredis';

export const DAILY_COUNTER = Symbol('DAILY_COUNTER');

// Counts uses per UTC day against a cap (Ask Sofiya's daily budget).
export interface DailyCounter {
  // Takes one use if the cap is not reached yet; false when it is.
  tryTake(name: string, cap: number): Promise<boolean>;
}

const today = () => new Date().toISOString().slice(0, 10);

export class MemoryDailyCounter implements DailyCounter {
  private counts = new Map<string, number>();
  private day = today();

  tryTake(name: string, cap: number): Promise<boolean> {
    if (this.day !== today()) {
      this.day = today();
      this.counts.clear();
    }
    const used = this.counts.get(name) ?? 0;
    if (used >= cap) return Promise.resolve(false);
    this.counts.set(name, used + 1);
    return Promise.resolve(true);
  }
}

// One count shared by every instance. INCR is atomic, so two instances can
// never both take the last use. Keys expire after two days.
export class RedisDailyCounter implements DailyCounter {
  private readonly logger = new Logger(RedisDailyCounter.name);
  private readonly fallback = new MemoryDailyCounter();

  constructor(private readonly redis: Redis) {}

  async tryTake(name: string, cap: number): Promise<boolean> {
    if (this.redis.status !== 'ready') return this.fallback.tryTake(name, cap);
    const key = `sofiya:daily:${name}:${today()}`;
    try {
      const [[, count]] = (await this.redis
        .multi()
        .incr(key)
        .expire(key, 2 * 24 * 60 * 60)
        .exec()) as [[Error | null, number]];
      if (count <= cap) return true;
      await this.redis.decr(key);
      return false;
    } catch (err) {
      // Fail open to this instance's own count rather than blocking Ask Sofiya.
      this.logger.warn(`Daily counter unavailable: ${(err as Error).message}`);
      return this.fallback.tryTake(name, cap);
    }
  }
}
