import { INestApplication } from '@nestjs/common';
import type { OrderView, Page, PublicUser } from '@sofiya/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { orders } from '../src/db/schema';
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

describe('Orders (e2e)', () => {
  let app: INestApplication<App>;
  const handle = testDb();
  const db = handle.db;

  const placeOrder = (
    agent: Agent,
    lines: { formatId: string; quantity: number; [k: string]: unknown }[],
    idempotencyKey: string = randomUUID(),
    currency?: 'KRW' | 'USD',
  ) =>
    agent
      .post('/api/orders')
      .set('Origin', WEB_ORIGIN)
      .send({ idempotencyKey, lines, currency });

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

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('requires a signed-in user', async () => {
    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Origin', WEB_ORIGIN)
      .send({ idempotencyKey: randomUUID(), lines: [] })
      .expect(401);
  });

  describe('pricing and stock', () => {
    it('LEGACY: ignores a client-sent price and charges the database price', async () => {
      const { formatId } = await createBook(db, { priceCents: 1234 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(
        agent,
        [{ formatId, quantity: 2, unitPriceCents: 1, itemPrice: 1 }],
        randomUUID(),
        'USD',
      ).expect(201);
      const order = res.body as OrderView;
      expect(order.currency).toBe('USD');
      expect(order.subtotal).toBe(2468);
      expect(order.delivery).toBe(500);
      expect(order.total).toBe(2968);
      expect(order.items[0].unitPrice).toBe(1234);
      expect(order.status).toBe('PAUSED');
    });

    it('makes delivery free from $100', async () => {
      const { formatId } = await createBook(db, { priceCents: 2500 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(
        agent,
        [{ formatId, quantity: 4 }],
        randomUUID(),
        'USD',
      ).expect(201);
      expect((res.body as OrderView).delivery).toBe(0);
    });

    it('charges the won price by default, with ₩3,000 delivery', async () => {
      const { formatId } = await createBook(db, { priceKrw: 12_000 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [{ formatId, quantity: 2 }]).expect(
        201,
      );
      const order = res.body as OrderView;
      expect(order.currency).toBe('KRW');
      expect(order.subtotal).toBe(24_000);
      expect(order.delivery).toBe(3_000);
      expect(order.total).toBe(27_000);
      expect(order.items[0].unitPrice).toBe(12_000);
      const [row] = await db
        .select({ currency: orders.currency })
        .from(orders)
        .where(eq(orders.id, order.id));
      expect(row.currency).toBe('KRW');
    });

    it('makes delivery free from ₩30,000', async () => {
      const { formatId } = await createBook(db, { priceKrw: 15_000 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [{ formatId, quantity: 2 }]).expect(
        201,
      );
      expect((res.body as OrderView).delivery).toBe(0);
    });

    it('charges no delivery when the order has only digital formats', async () => {
      const ebook = await createBook(db, { format: 'EBOOK', priceKrw: 9_000 });
      const audio = await createBook(db, {
        format: 'AUDIOBOOK',
        priceKrw: 6_000,
      });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [
        { formatId: ebook.formatId, quantity: 1 },
        { formatId: audio.formatId, quantity: 1 },
      ]).expect(201);
      const order = res.body as OrderView;
      expect(order.subtotal).toBe(15_000);
      expect(order.delivery).toBe(0);
      expect(order.total).toBe(15_000);
    });

    it('keeps the delivery rule when digital and printed books are mixed', async () => {
      const ebook = await createBook(db, { format: 'EBOOK', priceKrw: 9_000 });
      const paperback = await createBook(db, { priceKrw: 6_000 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [
        { formatId: ebook.formatId, quantity: 1 },
        { formatId: paperback.formatId, quantity: 1 },
      ]).expect(201);
      const order = res.body as OrderView;
      expect(order.delivery).toBe(3_000);
      expect(order.total).toBe(18_000);
    });

    it('rejects currencies the store does not sell in', async () => {
      const { formatId } = await createBook(db);
      const { agent } = await signedInAgent(app);
      await agent
        .post('/api/orders')
        .set('Origin', WEB_ORIGIN)
        .send({
          idempotencyKey: randomUUID(),
          lines: [{ formatId, quantity: 1 }],
          currency: 'EUR',
        })
        .expect(400);
    });

    it('LEGACY: takes copies out of stock, and refuses to oversell', async () => {
      const { formatId } = await createBook(db, { stock: 3 });
      const { agent } = await signedInAgent(app);
      await placeOrder(agent, [{ formatId, quantity: 2 }]).expect(201);
      expect(await stockOf(db, formatId)).toBe(1);
      const res = await placeOrder(agent, [{ formatId, quantity: 2 }]).expect(
        409,
      );
      expect(res.body.formatIds).toEqual([formatId]);
      expect(await stockOf(db, formatId)).toBe(1);
    });

    it('sells the last copy to exactly one of two simultaneous buyers', async () => {
      const { formatId } = await createBook(db, { stock: 1 });
      const [a, b] = await Promise.all([
        signedInAgent(app),
        signedInAgent(app),
      ]);
      const results = await Promise.all([
        placeOrder(a.agent, [{ formatId, quantity: 1 }]),
        placeOrder(b.agent, [{ formatId, quantity: 1 }]),
      ]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await stockOf(db, formatId)).toBe(0);
    });

    it('does not track stock for digital formats', async () => {
      const { formatId } = await createBook(db, { stock: null });
      const { agent } = await signedInAgent(app);
      await placeOrder(agent, [{ formatId, quantity: 20 }]).expect(201);
      expect(await stockOf(db, formatId)).toBeNull();
    });

    it('rejects paused books and unknown formats', async () => {
      const paused = await createBook(db, { live: false });
      const { agent } = await signedInAgent(app);
      await placeOrder(agent, [
        { formatId: paused.formatId, quantity: 1 },
      ]).expect(422);
      await placeOrder(agent, [{ formatId: randomUUID(), quantity: 1 }]).expect(
        422,
      );
    });

    it('validates quantities', async () => {
      const { formatId } = await createBook(db);
      const { agent } = await signedInAgent(app);
      await placeOrder(agent, [{ formatId, quantity: 0 }]).expect(400);
      // Two lines for the same format are merged and capped at 20.
      await placeOrder(agent, [
        { formatId, quantity: 15 },
        { formatId, quantity: 15 },
      ]).expect(400);
    });
  });

  describe('idempotency', () => {
    it('returns the same order when a checkout request is retried', async () => {
      const { formatId } = await createBook(db, { stock: 5 });
      const { agent } = await signedInAgent(app);
      const key = randomUUID();
      const first = await placeOrder(agent, [{ formatId, quantity: 1 }], key);
      const second = await placeOrder(agent, [{ formatId, quantity: 1 }], key);
      expect(first.status).toBe(201);
      expect(second.status).toBe(200);
      expect((second.body as OrderView).id).toBe((first.body as OrderView).id);
      expect(await stockOf(db, formatId)).toBe(4);
    });

    it('creates one order when the same request arrives five times at once', async () => {
      const { formatId } = await createBook(db, { stock: 10 });
      const { agent } = await signedInAgent(app);
      const key = randomUUID();
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          placeOrder(agent, [{ formatId, quantity: 1 }], key),
        ),
      );
      const ids = new Set(results.map((r) => (r.body as OrderView).id));
      expect(ids.size).toBe(1);
      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      expect(await stockOf(db, formatId)).toBe(9);
    });

    it('rejects a reused key with different lines', async () => {
      const { formatId } = await createBook(db);
      const { agent } = await signedInAgent(app);
      const key = randomUUID();
      await placeOrder(agent, [{ formatId, quantity: 1 }], key).expect(201);
      await placeOrder(agent, [{ formatId, quantity: 2 }], key).expect(409);
    });

    it('rejects a reused key with a different currency', async () => {
      const { formatId } = await createBook(db);
      const { agent } = await signedInAgent(app);
      const key = randomUUID();
      await placeOrder(agent, [{ formatId, quantity: 1 }], key, 'KRW').expect(
        201,
      );
      await placeOrder(agent, [{ formatId, quantity: 1 }], key, 'USD').expect(
        409,
      );
    });
  });

  describe('customer access', () => {
    it("lists only the customer's own orders and hides other people's", async () => {
      const { formatId } = await createBook(db);
      const alice = await signedInAgent(app);
      const bob = await signedInAgent(app);
      const res = await placeOrder(alice.agent, [
        { formatId, quantity: 1 },
      ]).expect(201);
      const orderId = (res.body as OrderView).id;

      const bobList = await bob.agent.get('/api/orders').expect(200);
      expect((bobList.body as Page<OrderView>).total).toBe(0);
      await bob.agent.get(`/api/orders/${orderId}`).expect(404);
      await bob.agent
        .post(`/api/orders/${orderId}/cancel`)
        .set('Origin', WEB_ORIGIN)
        .expect(404);

      const aliceList = await alice.agent.get('/api/orders').expect(200);
      expect((aliceList.body as Page<OrderView>).items[0].id).toBe(orderId);
    });

    it('lets a customer cancel a paused order, putting the stock back', async () => {
      const { formatId } = await createBook(db, { stock: 5 });
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [{ formatId, quantity: 3 }]).expect(
        201,
      );
      const id = (res.body as OrderView).id;
      expect(await stockOf(db, formatId)).toBe(2);
      const cancelled = await agent
        .post(`/api/orders/${id}/cancel`)
        .set('Origin', WEB_ORIGIN)
        .expect(200);
      expect((cancelled.body as OrderView).status).toBe('CANCELLED');
      expect(await stockOf(db, formatId)).toBe(5);
      await agent
        .post(`/api/orders/${id}/cancel`)
        .set('Origin', WEB_ORIGIN)
        .expect(409);
    });

    it('LEGACY: customers cannot change an order status themselves', async () => {
      const { formatId } = await createBook(db);
      const { agent } = await signedInAgent(app);
      const res = await placeOrder(agent, [{ formatId, quantity: 1 }]).expect(
        201,
      );
      const id = (res.body as OrderView).id;
      await adminSet(agent, id, 'PAUSED', 'DELIVERED').expect(403);
      await agent
        .patch(`/api/orders/${id}`)
        .set('Origin', WEB_ORIGIN)
        .send({ status: 'DELIVERED' })
        .expect(404);
      const [row] = await db.select().from(orders).where(eq(orders.id, id));
      expect(row.status).toBe('PAUSED');
    });
  });

  describe('admin status changes', () => {
    it('moves an order forward and awards points exactly once', async () => {
      const { formatId } = await createBook(db);
      const customer = await signedInAgent(app);
      const admin = await adminAgent();
      const res = await placeOrder(customer.agent, [
        { formatId, quantity: 1 },
      ]).expect(201);
      const id = (res.body as OrderView).id;

      const inProcess = await adminSet(
        admin,
        id,
        'PAUSED',
        'IN_PROCESS',
      ).expect(200);
      expect((inProcess.body as OrderView).pointsAwarded).toBe(1);
      await adminSet(admin, id, 'IN_PROCESS', 'DELIVERED').expect(200);

      const me = await customer.agent.get('/api/me').expect(200);
      expect((me.body as PublicUser).points).toBe(1);
    });

    it('LEGACY: an order cannot go back to IN_PROCESS to farm points', async () => {
      const { formatId } = await createBook(db);
      const customer = await signedInAgent(app);
      const admin = await adminAgent();
      const res = await placeOrder(customer.agent, [
        { formatId, quantity: 1 },
      ]).expect(201);
      const id = (res.body as OrderView).id;
      await adminSet(admin, id, 'PAUSED', 'IN_PROCESS').expect(200);
      await adminSet(admin, id, 'IN_PROCESS', 'DELIVERED').expect(200);
      await adminSet(admin, id, 'DELIVERED', 'IN_PROCESS').expect(409);
      await adminSet(admin, id, 'PAUSED', 'IN_PROCESS').expect(409);
      const me = await customer.agent.get('/api/me').expect(200);
      expect((me.body as PublicUser).points).toBe(1);
    });

    it('refuses a change based on a stale status', async () => {
      const { formatId } = await createBook(db);
      const customer = await signedInAgent(app);
      const admin = await adminAgent();
      const res = await placeOrder(customer.agent, [
        { formatId, quantity: 1 },
      ]).expect(201);
      const id = (res.body as OrderView).id;
      await adminSet(admin, id, 'PAUSED', 'IN_PROCESS').expect(200);
      // A second admin tab still thinks the order is PAUSED.
      await adminSet(admin, id, 'PAUSED', 'CANCELLED').expect(409);
    });

    it('cancelling an order in process restores stock and takes back the points', async () => {
      const { formatId } = await createBook(db, { stock: 4 });
      const customer = await signedInAgent(app);
      const admin = await adminAgent();
      const res = await placeOrder(customer.agent, [
        { formatId, quantity: 2 },
      ]).expect(201);
      const id = (res.body as OrderView).id;
      await adminSet(admin, id, 'PAUSED', 'IN_PROCESS').expect(200);
      await adminSet(admin, id, 'IN_PROCESS', 'CANCELLED').expect(200);
      expect(await stockOf(db, formatId)).toBe(4);
      const me = await customer.agent.get('/api/me').expect(200);
      expect((me.body as PublicUser).points).toBe(0);
    });

    it('lets admins list every order', async () => {
      const { formatId } = await createBook(db);
      const customer = await signedInAgent(app);
      const admin = await adminAgent();
      await placeOrder(customer.agent, [{ formatId, quantity: 1 }]).expect(201);
      const res = await admin.get('/api/admin/orders?limit=50').expect(200);
      const [{ total }] = await db.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM orders`,
      );
      expect((res.body as Page<OrderView>).total).toBe(Number(total));
      await customer.agent.get('/api/admin/orders').expect(403);
    });
  });
});
