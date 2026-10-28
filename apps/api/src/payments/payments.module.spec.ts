import { loadEnv } from '../config/env';
import { paymentConfig } from './payments.module';

describe('paymentConfig', () => {
  it('reports test mode for Toss test keys and turns it off for live keys', () => {
    const test = paymentConfig(
      loadEnv({ TOSS_CLIENT_KEY: 'test_ck_x', TOSS_SECRET_KEY: 'test_sk_x' }),
    );
    expect(test.card).toMatchObject({
      enabled: true,
      provider: 'toss',
      testMode: true,
    });
    const live = paymentConfig(
      loadEnv({ TOSS_CLIENT_KEY: 'live_ck_x', TOSS_SECRET_KEY: 'live_sk_x' }),
    );
    expect(live.card.testMode).toBe(false);
  });

  it('switches cards off without keys', () => {
    expect(paymentConfig(loadEnv({})).card).toMatchObject({
      enabled: false,
      provider: null,
    });
  });
});
