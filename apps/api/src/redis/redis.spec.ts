import Redis from 'ioredis';
import { MemoryDailyCounter, RedisDailyCounter } from './daily-counter';
import { createRedis, FailOpenThrottlerStorage } from './redis';

// Runs against a real Redis when REDIS_TEST_URL is set
// (e.g. redis-server --port 6390, REDIS_TEST_URL=redis://127.0.0.1:6390).
const REDIS_TEST_URL = process.env.REDIS_TEST_URL;
const withRedis = REDIS_TEST_URL ? describe : describe.skip;

const ready = (r: Redis) =>
  new Promise<void>((resolve) =>
    r.status === 'ready' ? resolve() : r.once('ready', () => resolve()),
  );

describe('MemoryDailyCounter', () => {
  it('allows uses up to the cap, then refuses', async () => {
    const c = new MemoryDailyCounter();
    expect(await c.tryTake('ask', 2)).toBe(true);
    expect(await c.tryTake('ask', 2)).toBe(true);
    expect(await c.tryTake('ask', 2)).toBe(false);
    expect(await c.tryTake('other', 2)).toBe(true);
  });
});

describe('when Redis is unreachable', () => {
  it('falls back to memory for limits and the daily cap', async () => {
    const redis = createRedis('redis://127.0.0.1:1')!; // nothing listens on port 1
    try {
      const storage = new FailOpenThrottlerStorage(redis);
      const record = await storage.increment(
        'ip:1',
        60_000,
        5,
        60_000,
        'default',
      );
      expect(record.totalHits).toBe(1);
      const counter = new RedisDailyCounter(redis);
      expect(await counter.tryTake('ask', 1)).toBe(true);
      expect(await counter.tryTake('ask', 1)).toBe(false);
    } finally {
      redis.disconnect();
    }
  });
});

withRedis('with a real Redis', () => {
  let redis: Redis;
  const name = `test-${Date.now()}`;

  beforeAll(async () => {
    redis = createRedis(REDIS_TEST_URL)!;
    await ready(redis);
  });
  afterAll(async () => {
    await redis.quit();
  });

  it('shares one daily count between instances and never goes over the cap', async () => {
    const a = new RedisDailyCounter(redis);
    const b = new RedisDailyCounter(redis);
    // Ten parallel takes from two "instances" against a cap of 3.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) => (i % 2 ? a : b).tryTake(name, 3)),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    const key = (await redis.keys(`sofiya:daily:${name}:*`))[0];
    expect(Number(await redis.get(key))).toBe(3);
    expect(await redis.ttl(key)).toBeGreaterThan(0);
  });

  it('counts rate-limit hits in Redis', async () => {
    const storage = new FailOpenThrottlerStorage(redis);
    const key = `rate-${Date.now()}`;
    await storage.increment(key, 60_000, 2, 60_000, 'default');
    await storage.increment(key, 60_000, 2, 60_000, 'default');
    const third = await new FailOpenThrottlerStorage(redis).increment(
      key,
      60_000,
      2,
      60_000,
      'default',
    );
    expect(third.totalHits).toBe(3);
    expect(third.isBlocked).toBe(true);
  });
});
