import { Controller, Get, Global, Module } from '@nestjs/common';
import type { Currency, PaymentConfig } from '@sofiya/shared';
import { loadEnv, type Env } from '../config/env';
import {
  FakeGateway,
  PAYMENT_GATEWAY,
  TossGateway,
  type PaymentGateway,
} from './gateway';

export function createGateway(env: Env): PaymentGateway | null {
  if (env.PAYMENTS_PROVIDER === 'fake') return new FakeGateway();
  if (env.TOSS_SECRET_KEY && env.TOSS_CLIENT_KEY) {
    return new TossGateway(env.TOSS_SECRET_KEY);
  }
  return null;
}

export function paymentConfig(env: Env): PaymentConfig {
  const gateway = createGateway(env);
  return {
    card: {
      enabled: gateway !== null,
      provider:
        gateway instanceof FakeGateway ? 'fake' : gateway ? 'toss' : null,
      // Live keys start with live_; anything else cannot charge real money.
      testMode:
        gateway instanceof FakeGateway ||
        !env.TOSS_CLIENT_KEY?.startsWith('live_'),
      clientKey: env.TOSS_CLIENT_KEY ?? null,
      currencies: env.CARD_CURRENCIES.filter(
        (c): c is Currency => c === 'KRW' || c === 'USD',
      ),
    },
    bankTransfer: {
      bankName: env.BANK_NAME ?? null,
      accountNumber: env.BANK_ACCOUNT_NUMBER ?? null,
      accountHolder: env.BANK_ACCOUNT_HOLDER ?? null,
    },
    cardTimeoutMinutes: env.CARD_PAYMENT_TIMEOUT_MINUTES,
  };
}

@Controller('payments')
export class PaymentsController {
  private readonly config: PaymentConfig;

  constructor() {
    const env = loadEnv();
    this.config = paymentConfig(env);
  }

  // Public: what the checkout page can offer.
  @Get('config')
  get(): PaymentConfig {
    return this.config;
  }
}

@Global()
@Module({
  controllers: [PaymentsController],
  providers: [
    { provide: PAYMENT_GATEWAY, useFactory: () => createGateway(loadEnv()) },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
