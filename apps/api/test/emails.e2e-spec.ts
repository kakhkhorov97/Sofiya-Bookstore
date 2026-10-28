import { INestApplication } from '@nestjs/common';
import type { OrderView } from '@sofiya/shared';
import { eq, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { passwordResetTokens, users } from '../src/db/schema';
import { MAILER, type MemoryMailer } from '../src/mail/mailer';
import { OrderEmailsService } from '../src/orders/order-emails.service';
import {
  createBook,
  createTestApp,
  makeAdmin,
  signedInAgent,
  testDb,
  uniqueEmail,
  WEB_ORIGIN,
} from './fixtures';

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

describe('Emails: password reset and order updates (e2e)', () => {
  let app: INestApplication<App>;
  let mailer: MemoryMailer;
  const handle = testDb();
  const db = handle.db;
  const post = (path: string, body: object) =>
    request(app.getHttpServer())
      .post(path)
      .set('Origin', WEB_ORIGIN)
      .send(body);
  // Sign-up confirmations are tested in auth-verification.e2e-spec.ts.
  const sentTo = (email: string) =>
    mailer.sent.filter(
      (m) => m.to === email && !m.subject.startsWith('Confirm your email'),
    );
  const tokenFrom = (text: string) =>
    new URL(/http\S+/.exec(text)![0]).searchParams.get('token')!;

  beforeAll(async () => {
    app = await createTestApp();
    mailer = app.get<MemoryMailer>(MAILER);
  });
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  describe('password reset', () => {
    it('answers the same for unknown emails and sends nothing', async () => {
      const email = uniqueEmail();
      const res = await post('/api/auth/password/forgot', { email }).expect(
        202,
      );
      expect(res.body).toEqual({ sent: true });
      expect(sentTo(email)).toHaveLength(0);
    });

    it('resets the password with the emailed link and signs out old sessions', async () => {
      const { agent, email, password } = await signedInAgent(app);
      await post('/api/auth/password/forgot', {
        email: email.toUpperCase(),
      }).expect(202);
      const [mail] = sentTo(email);
      expect(mail.subject).toBe('Reset your Sofiya password');
      expect(mail.text).toContain(
        'http://localhost:3000/reset-password?token=',
      );
      const token = tokenFrom(mail.text);
      // Only a hash is stored.
      const [stored] = await db.select().from(passwordResetTokens);
      expect(JSON.stringify(stored)).not.toContain(token);

      await post('/api/auth/password/reset', {
        token,
        password: 'short',
      }).expect(400);
      // Sessions issued before the reset stop working; wait past the second.
      await new Promise((r) => setTimeout(r, 1100));
      await post('/api/auth/password/reset', {
        token,
        password: 'a brand new password',
      }).expect(200);
      await agent.get('/api/me').expect(401);

      await post('/api/auth/signin', { email, password }).expect(401);
      await post('/api/auth/signin', {
        email,
        password: 'a brand new password',
      }).expect(200);
      // The link works once.
      await post('/api/auth/password/reset', {
        token,
        password: 'another new password',
      }).expect(400);
    });

    it('sends at most one email a minute per account', async () => {
      const { email } = await signedInAgent(app);
      await post('/api/auth/password/forgot', { email }).expect(202);
      await post('/api/auth/password/forgot', { email }).expect(202);
      expect(sentTo(email)).toHaveLength(1);
    });

    it('refuses expired links', async () => {
      const { email } = await signedInAgent(app);
      await post('/api/auth/password/forgot', { email }).expect(202);
      const token = tokenFrom(sentTo(email)[0].text);
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, email));
      await db
        .update(passwordResetTokens)
        .set({ expiresAt: sql`now() - interval '1 minute'` })
        .where(eq(passwordResetTokens.userId, user.id));
      const res = await post('/api/auth/password/reset', {
        token,
        password: 'a brand new password',
      }).expect(400);
      expect(res.body.message).toMatch(/invalid or has expired/);
    });
  });

  describe('order emails', () => {
    const flush = () => app.get(OrderEmailsService).flush();
    const placeOrder = (
      agent: Agent,
      formatId: string,
      paymentMethod: 'CARD' | 'BANK_TRANSFER',
    ) =>
      agent
        .post('/api/orders')
        .set('Origin', WEB_ORIGIN)
        .send({
          idempotencyKey: randomUUID(),
          lines: [{ formatId, quantity: 1 }],
          paymentMethod,
        });
    async function adminAgent() {
      const a = await signedInAgent(app);
      await makeAdmin(db, a.email);
      return a.agent;
    }
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

    it('emails bank-transfer instructions, then the confirmation and delivery', async () => {
      const { formatId } = await createBook(db);
      const { agent, email } = await signedInAgent(app);
      const order = (
        await placeOrder(agent, formatId, 'BANK_TRANSFER').expect(201)
      ).body as OrderView;
      await flush();
      expect(sentTo(email).map((m) => m.subject)).toEqual([
        `Order #${order.id.slice(0, 8)} received: please pay by bank transfer`,
      ]);
      expect(sentTo(email)[0].text).toContain(
        `http://localhost:3000/orders/${order.id}`,
      );

      const admin = await adminAgent();
      await adminSet(admin, order.id, 'PAUSED', 'IN_PROCESS').expect(200);
      await adminSet(admin, order.id, 'IN_PROCESS', 'DELIVERED').expect(200);
      await flush();
      expect(sentTo(email).map((m) => m.subject)).toEqual([
        expect.stringContaining('received'),
        `Order #${order.id.slice(0, 8)} confirmed`,
        `Order #${order.id.slice(0, 8)} delivered`,
      ]);
    });

    it('emails a card order only once paid, and says when it was refunded', async () => {
      const { formatId } = await createBook(db, { priceKrw: 12_000 });
      const { agent, email } = await signedInAgent(app);
      const order = (await placeOrder(agent, formatId, 'CARD').expect(201))
        .body as OrderView;
      await flush();
      expect(sentTo(email)).toHaveLength(0);

      await agent
        .post(`/api/orders/${order.id}/payments/toss/confirm`)
        .set('Origin', WEB_ORIGIN)
        .send({ paymentKey: `fake_ok_${randomUUID()}`, amount: order.total })
        .expect(200);
      const admin = await adminAgent();
      await adminSet(admin, order.id, 'IN_PROCESS', 'CANCELLED').expect(200);
      await flush();
      const [confirmed, cancelled] = sentTo(email);
      expect(confirmed.text).toContain(
        'Your card payment of ₩15,000 has been received',
      );
      expect(cancelled.subject).toContain('cancelled');
      expect(cancelled.text).toContain('has been refunded');
    });
  });
});
