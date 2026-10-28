import { INestApplication } from '@nestjs/common';
import type { OrderView, PaymentConfig } from '@sofiya/shared';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { orders } from '../src/db/schema';
import { OrdersService } from '../src/orders/orders.service';
import { FakeGateway, PAYMENT_GATEWAY } from '../src/payments/gateway';
import {
  createBook,
  createTestApp,
  makeAdmin,
  signedInAgent,
  stockOf,
  testDb,
  WEB_ORIGIN,
} from './fixtures';

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

describe('Payments (e2e)', () => {
  let app: INestApplication<App>;
  let gateway: FakeGateway;
  const handle = testDb();
  const db = handle.db;

  const order = (
    agent: Agent,
    formatId: string,
    paymentMethod: 'CARD' | 'BANK_TRANSFER',
    currency: 'KRW' | 'USD' = 'KRW',
    quantity = 1,
  ) =>
    agent
      .post('/api/orders')
      .set('Origin', WEB_ORIGIN)
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ formatId, quantity }],
        currency,
        paymentMethod,
      });

  const confirm = (
    agent: Agent,
    id: string,
    paymentKey: string,
    amount: number,
  ) =>
    agent
      .post(`/api/orders/${id}/payments/toss/confirm`)
      .set('Origin', WEB_ORIGIN)
      .send({ paymentKey, amount });

  const adminSet = (
    agent: Agent,
    id: string,
    expectedStatus: string,
    status: string,
  ) =>
    agent
      .patch(`/api/admin/orders/${id}/status`)
      .set('Origin', WEB_ORIGIN)
      .send({ expectedStatus, status });

  async function adminAgent() {
    const a = await signedInAgent(app);
    await makeAdmin(db, a.email);
    return a.agent;
  }

  async function placeCardOrder(stock = 5) {
    const { formatId } = await createBook(db, { priceKrw: 12_000, stock });
    const reader = await signedInAgent(app);
    const res = await order(reader.agent, formatId, 'CARD').expect(201);
    return { reader, formatId, created: res.body as OrderView };
  }

  beforeAll(async () => {
    app = await createTestApp();
    gateway = app.get<FakeGateway>(PAYMENT_GATEWAY);
  });
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('tells the checkout which payment methods exist', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/payments/config')
      .expect(200);
    const config = res.body as PaymentConfig;
    expect(config.card).toMatchObject({
      enabled: true,
      provider: 'fake',
      testMode: true,
      currencies: ['KRW'],
    });
    expect(config.cardTimeoutMinutes).toBe(30);
  });

  it('takes a card payment: unpaid order, then paid and confirmed with a point', async () => {
    const { reader, formatId, created } = await placeCardOrder();
    expect(created.status).toBe('PAUSED');
    expect(created.payment).toMatchObject({ method: 'CARD', status: 'UNPAID' });
    // Stock is held while the customer pays.
    expect(await stockOf(db, formatId)).toBe(4);

    const res = await confirm(
      reader.agent,
      created.id,
      'fake_ok_1',
      15_000,
    ).expect(200);
    const paid = res.body as OrderView;
    expect(paid.status).toBe('IN_PROCESS');
    expect(paid.payment.status).toBe('PAID');
    expect(paid.payment.receiptUrl).toContain('fake_ok_1');
    expect(paid.pointsAwarded).toBe(1);
    expect(
      ((await reader.agent.get('/api/me')).body as { points: number }).points,
    ).toBe(1);

    // A refreshed success page confirms again: same order, no second charge.
    await confirm(reader.agent, created.id, 'fake_ok_1', 15_000).expect(200);
    await confirm(reader.agent, created.id, 'fake_ok_other', 15_000).expect(
      409,
    );
  });

  it('confirms the stored total, never an amount from the browser', async () => {
    const { reader, created } = await placeCardOrder();
    // ₩12,000 + ₩3,000 delivery.
    expect(created.total).toBe(15_000);
    await confirm(reader.agent, created.id, 'fake_ok_cheap', 100).expect(400);
    const again = (await reader.agent.get(`/api/orders/${created.id}`))
      .body as OrderView;
    expect(again.payment.status).toBe('UNPAID');
    await confirm(reader.agent, created.id, 'fake_ok_fair', 15_000).expect(200);
  });

  it('keeps the order unpaid when the card is declined, and lets the customer retry', async () => {
    const { reader, created } = await placeCardOrder();
    const res = await confirm(
      reader.agent,
      created.id,
      'fake_fail_1',
      15_000,
    ).expect(400);
    expect(res.body.message).toMatch(/declined/);
    const after = (await reader.agent.get(`/api/orders/${created.id}`))
      .body as OrderView;
    expect(after.payment).toMatchObject({
      status: 'UNPAID',
      error: expect.stringMatching(/declined/),
    });
    await confirm(reader.agent, created.id, 'fake_ok_retry', 15_000).expect(
      200,
    );
  });

  it("refuses to confirm someone else's order", async () => {
    const { created } = await placeCardOrder();
    const other = await signedInAgent(app);
    await confirm(other.agent, created.id, 'fake_ok_x', 15_000).expect(404);
  });

  it('only takes cards in the configured currencies', async () => {
    const { formatId } = await createBook(db);
    const { agent } = await signedInAgent(app);
    const res = await order(agent, formatId, 'CARD', 'USD').expect(400);
    expect(res.body.message).toMatch(/not available in USD/);
    await order(agent, formatId, 'BANK_TRANSFER', 'USD').expect(201);
  });

  it('does not let the admin confirm an unpaid card order', async () => {
    const { created } = await placeCardOrder();
    const admin = await adminAgent();
    const res = await adminSet(
      admin,
      created.id,
      'PAUSED',
      'IN_PROCESS',
    ).expect(409);
    expect(res.body.message).toMatch(/waiting for the customer to pay/);
  });

  it('refunds a paid card order when the admin cancels it', async () => {
    const { reader, formatId, created } = await placeCardOrder();
    await confirm(reader.agent, created.id, 'fake_ok_refund', 15_000).expect(
      200,
    );
    const admin = await adminAgent();
    const res = await adminSet(
      admin,
      created.id,
      'IN_PROCESS',
      'CANCELLED',
    ).expect(200);
    const cancelled = res.body as OrderView;
    expect(cancelled.payment.status).toBe('REFUNDED');
    expect(gateway.cancelled).toContain('fake_ok_refund');
    expect(await stockOf(db, formatId)).toBe(5);
    // The point from the paid order is taken back.
    expect(
      ((await reader.agent.get('/api/me')).body as { points: number }).points,
    ).toBe(0);
  });

  it('marks a bank transfer paid when the admin confirms the order', async () => {
    const { formatId } = await createBook(db);
    const { agent } = await signedInAgent(app);
    const created = (await order(agent, formatId, 'BANK_TRANSFER').expect(201))
      .body as OrderView;
    expect(created.payment).toMatchObject({
      method: 'BANK_TRANSFER',
      status: 'UNPAID',
    });
    const admin = await adminAgent();
    const res = await adminSet(
      admin,
      created.id,
      'PAUSED',
      'IN_PROCESS',
    ).expect(200);
    expect((res.body as OrderView).payment.status).toBe('PAID');
    // Bank-transfer orders can't be confirmed as card payments.
    await confirm(agent, created.id, 'fake_ok_bt', created.total).expect(400);
  });

  it('cancels card orders that were not paid in time and returns the stock', async () => {
    const { reader, formatId, created } = await placeCardOrder(3);
    expect(await stockOf(db, formatId)).toBe(2);
    await db
      .update(orders)
      .set({ createdAt: sql`now() - interval '31 minutes'` })
      .where(eq(orders.id, created.id));

    expect(
      await app.get(OrdersService).expireUnpaidCardOrders(),
    ).toBeGreaterThanOrEqual(1);
    const after = (await reader.agent.get(`/api/orders/${created.id}`))
      .body as OrderView;
    expect(after.status).toBe('CANCELLED');
    expect(await stockOf(db, formatId)).toBe(3);
    const res = await confirm(
      reader.agent,
      created.id,
      'fake_ok_late',
      15_000,
    ).expect(409);
    expect(res.body.message).toMatch(/cancelled/);
  });
});
