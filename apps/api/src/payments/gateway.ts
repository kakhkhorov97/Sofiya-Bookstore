import type { Currency } from '@sofiya/shared';

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface ConfirmedPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  approvedAt: string | null;
  receiptUrl: string | null;
}

export interface PaymentGateway {
  // Approves a payment the customer authorised in the payment window.
  confirm(input: {
    paymentKey: string;
    orderId: string;
    amount: number;
    currency: Currency;
  }): Promise<ConfirmedPayment>;
  // Cancels (refunds) the whole payment.
  cancel(
    paymentKey: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<void>;
}

// A refusal from the payment provider, with a message fit for the customer.
export class PaymentError extends Error {
  constructor(
    readonly code: string,
    message: string,
    // false when Toss could not be reached at all.
    readonly fromProvider = true,
  ) {
    super(message);
  }
}

const TOSS_API = 'https://api.tosspayments.com/v1/payments';

interface TossPayment {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  currency: string;
  approvedAt?: string | null;
  receipt?: { url?: string } | null;
}

// Toss Payments "API 개별 연동" (individual integration). The secret key
// authenticates as HTTP Basic "<secret>:". Idempotency-Key makes a retried
// confirm or cancel safe: Toss answers it once.
export class TossGateway implements PaymentGateway {
  private readonly auth: string;

  constructor(
    secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.auth = `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`;
  }

  async confirm(input: {
    paymentKey: string;
    orderId: string;
    amount: number;
    currency: Currency;
  }): Promise<ConfirmedPayment> {
    const p = await this.post<TossPayment>(
      `${TOSS_API}/confirm`,
      {
        paymentKey: input.paymentKey,
        orderId: input.orderId,
        amount: input.amount,
      },
      input.paymentKey,
    );
    return {
      paymentKey: p.paymentKey,
      orderId: p.orderId,
      status: p.status,
      totalAmount: p.totalAmount,
      currency: p.currency,
      approvedAt: p.approvedAt ?? null,
      receiptUrl: p.receipt?.url ?? null,
    };
  }

  async cancel(
    paymentKey: string,
    reason: string,
    idempotencyKey: string,
  ): Promise<void> {
    await this.post(
      `${TOSS_API}/${encodeURIComponent(paymentKey)}/cancel`,
      { cancelReason: reason },
      idempotencyKey,
    );
  }

  private async post<T>(
    url: string,
    body: object,
    idempotencyKey: string,
  ): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: this.auth,
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(body),
        // Toss asks for a generous timeout on approvals.
        signal: AbortSignal.timeout(60_000),
      });
    } catch {
      throw new PaymentError(
        'PROVIDER_UNREACHABLE',
        'The payment service could not be reached. You have not been charged; please try again.',
        false,
      );
    }
    const data = (await res.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    if (!res.ok) {
      throw new PaymentError(
        data.code ?? `HTTP_${res.status}`,
        data.message ?? 'The payment was not approved.',
      );
    }
    return data as T;
  }
}

// Offline stand-in for tests and local demos without Toss keys
// (PAYMENTS_PROVIDER=fake). Payment keys starting with "fake_fail" are
// refused, like a declined card.
export class FakeGateway implements PaymentGateway {
  readonly cancelled: string[] = [];

  confirm(input: {
    paymentKey: string;
    orderId: string;
    amount: number;
    currency: Currency;
  }): Promise<ConfirmedPayment> {
    if (input.paymentKey.startsWith('fake_fail')) {
      return Promise.reject(
        new PaymentError(
          'REJECT_CARD_COMPANY',
          'The card company declined this payment.',
        ),
      );
    }
    return Promise.resolve({
      paymentKey: input.paymentKey,
      orderId: input.orderId,
      status: 'DONE',
      totalAmount: input.amount,
      currency: input.currency,
      approvedAt: new Date().toISOString(),
      receiptUrl: `https://example.test/receipts/${input.paymentKey}`,
    });
  }

  cancel(paymentKey: string): Promise<void> {
    this.cancelled.push(paymentKey);
    return Promise.resolve();
  }
}
