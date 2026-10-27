import { PaymentError, TossGateway } from './gateway';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };
  return { impl, calls };
}

const input = {
  paymentKey: 'tgen_123',
  orderId: '0b6f7c2e-5a4d-4e3f-8a9b-1c2d3e4f5a6b',
  amount: 15_000,
  currency: 'KRW' as const,
};

describe('TossGateway', () => {
  it('confirms with Basic auth, an idempotency key and the stored amount', async () => {
    const { impl, calls } = fakeFetch(200, {
      paymentKey: 'tgen_123',
      orderId: input.orderId,
      status: 'DONE',
      totalAmount: 15_000,
      currency: 'KRW',
      approvedAt: '2026-10-27T10:00:00+09:00',
      receipt: { url: 'https://receipt.example/1' },
    });
    const result = await new TossGateway('test_sk_secret', impl).confirm(input);

    expect(calls[0].url).toBe(
      'https://api.tosspayments.com/v1/payments/confirm',
    );
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('test_sk_secret:').toString('base64')}`,
    );
    expect(headers['Idempotency-Key']).toBe('tgen_123');
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      paymentKey: 'tgen_123',
      orderId: input.orderId,
      amount: 15_000,
    });
    expect(result).toMatchObject({
      status: 'DONE',
      receiptUrl: 'https://receipt.example/1',
    });
  });

  it("turns Toss's error into a customer-facing message", async () => {
    const { impl } = fakeFetch(400, {
      code: 'REJECT_CARD_PAYMENT',
      message: '한도초과 혹은 잔액부족으로 결제에 실패했습니다.',
    });
    const err = await new TossGateway('k', impl)
      .confirm(input)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PaymentError);
    expect(err).toMatchObject({
      code: 'REJECT_CARD_PAYMENT',
      fromProvider: true,
    });
  });

  it('reports an unreachable Toss without claiming a charge', async () => {
    const impl = (() =>
      Promise.reject(new Error('ECONNRESET'))) as unknown as typeof fetch;
    const err = await new TossGateway('k', impl)
      .confirm(input)
      .catch((e: unknown) => e);
    expect(err).toMatchObject({
      code: 'PROVIDER_UNREACHABLE',
      fromProvider: false,
    });
    expect((err as Error).message).toMatch(/not been charged/);
  });

  it('cancels a payment by its key with a reason', async () => {
    const { impl, calls } = fakeFetch(200, { status: 'CANCELED' });
    await new TossGateway('k', impl).cancel(
      'tgen_123',
      'Order cancelled',
      'refund-1',
    );
    expect(calls[0].url).toBe(
      'https://api.tosspayments.com/v1/payments/tgen_123/cancel',
    );
    expect(JSON.parse(calls[0].init.body as string)).toEqual({
      cancelReason: 'Order cancelled',
    });
    expect(
      (calls[0].init.headers as Record<string, string>)['Idempotency-Key'],
    ).toBe('refund-1');
  });
});
