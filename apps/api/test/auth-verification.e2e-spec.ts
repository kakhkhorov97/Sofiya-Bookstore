import { INestApplication } from '@nestjs/common';
import type { AuthProviders, PublicUser } from '@sofiya/shared';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { users } from '../src/db/schema';
import { MAILER, type MemoryMailer } from '../src/mail/mailer';
import {
  createBook,
  createTestApp,
  signedInAgent,
  testDb,
  uniqueEmail,
  WEB_ORIGIN,
} from './fixtures';

describe('Email confirmation and Google sign-in (e2e)', () => {
  let app: INestApplication<App>;
  let mailer: MemoryMailer;
  const handle = testDb();
  const db = handle.db;
  const confirmations = (email: string) =>
    mailer.sent.filter(
      (m) => m.to === email && m.subject === 'Confirm your email for Sofiya',
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

  describe('confirming the email address', () => {
    it('emails a link at sign-up; ordering and reviewing wait for it', async () => {
      const { agent, email } = await signedInAgent(
        app,
        uniqueEmail(),
        undefined,
        { verified: false },
      );
      const me = (await agent.get('/api/me').expect(200)).body as PublicUser;
      expect(me.emailVerified).toBe(false);
      const [mail] = confirmations(email);
      expect(mail.text).toContain('http://localhost:3000/verify-email?token=');

      const { formatId } = await createBook(db);
      const blocked = await agent
        .post('/api/orders')
        .set('Origin', WEB_ORIGIN)
        .send({
          idempotencyKey: randomUUID(),
          lines: [{ formatId, quantity: 1 }],
        })
        .expect(403);
      expect(blocked.body.code).toBe('EMAIL_NOT_VERIFIED');

      // The link works without a session (it may open in another browser), once.
      const token = tokenFrom(mail.text);
      await request(app.getHttpServer())
        .post('/api/auth/email/confirm')
        .set('Origin', WEB_ORIGIN)
        .send({ token })
        .expect(200);
      expect(
        ((await agent.get('/api/me')).body as PublicUser).emailVerified,
      ).toBe(true);
      await request(app.getHttpServer())
        .post('/api/auth/email/confirm')
        .set('Origin', WEB_ORIGIN)
        .send({ token })
        .expect(400);
      await agent
        .post('/api/orders')
        .set('Origin', WEB_ORIGIN)
        .send({
          idempotencyKey: randomUUID(),
          lines: [{ formatId, quantity: 1 }],
        })
        .expect(201);
    });

    it('resends at most once a minute, and only to the signed-in reader', async () => {
      const { agent, email } = await signedInAgent(
        app,
        uniqueEmail(),
        undefined,
        { verified: false },
      );
      await agent
        .post('/api/auth/email/resend')
        .set('Origin', WEB_ORIGIN)
        .expect(202);
      expect(confirmations(email)).toHaveLength(1);
      await request(app.getHttpServer())
        .post('/api/auth/email/resend')
        .set('Origin', WEB_ORIGIN)
        .expect(401);
    });
  });

  describe('Continue with Google', () => {
    // Starts at /api/auth/google, then plays Google's redirect back.
    async function googleSignIn(code: string, next = '/books') {
      const agent = request.agent(app.getHttpServer());
      const start = await agent
        .get(`/api/auth/google?next=${encodeURIComponent(next)}`)
        .expect(302);
      const state = new URL(start.headers.location).searchParams.get('state')!;
      const back = await agent
        .get(
          `/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${state}`,
        )
        .expect(302);
      return { agent, location: back.headers.location };
    }

    it('says Google sign-in is available', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/providers')
        .expect(200);
      expect(res.body as AuthProviders).toEqual({ google: true });
    });

    it('creates a confirmed account, then signs the same Google account in again', async () => {
      const sub = randomUUID();
      const email = uniqueEmail();
      const first = await googleSignIn(
        `fake:${sub}:${email}:true:Ada Lovelace`,
        '/orders',
      );
      expect(first.location).toBe('http://localhost:3000/orders');
      const me = (await first.agent.get('/api/me').expect(200))
        .body as PublicUser;
      expect(me).toMatchObject({
        email,
        displayName: 'Ada Lovelace',
        emailVerified: true,
      });

      const again = await googleSignIn(`fake:${sub}:${email}:true:Ada`);
      expect(((await again.agent.get('/api/me')).body as PublicUser).id).toBe(
        me.id,
      );
    });

    it('links to an existing confirmed account and keeps its password', async () => {
      const { email, password } = await signedInAgent(app);
      const { agent } = await googleSignIn(
        `fake:${randomUUID()}:${email}:true:X`,
      );
      await agent.get('/api/me').expect(200);
      await request(app.getHttpServer())
        .post('/api/auth/signin')
        .set('Origin', WEB_ORIGIN)
        .send({ email, password })
        .expect(200);
    });

    it("cancels an unconfirmed account's password and sessions when the real owner links it", async () => {
      // Someone signs up with an address they don't own and never confirms it.
      const squatter = await signedInAgent(app, uniqueEmail(), undefined, {
        verified: false,
      });
      await new Promise((r) => setTimeout(r, 1100)); // sessions are compared by the second
      const owner = await googleSignIn(
        `fake:${randomUUID()}:${squatter.email}:true:Owner`,
      );
      await owner.agent.get('/api/me').expect(200);
      await squatter.agent.get('/api/me').expect(401);
      await request(app.getHttpServer())
        .post('/api/auth/signin')
        .set('Origin', WEB_ORIGIN)
        .send({ email: squatter.email, password: squatter.password })
        .expect(401);
    });

    it('rejects a callback that this browser did not start', async () => {
      const res = await request(app.getHttpServer())
        .get(
          `/api/auth/google/callback?code=fake:${randomUUID()}:${uniqueEmail()}:true:X&state=forged`,
        )
        .expect(302);
      expect(res.headers.location).toBe(
        'http://localhost:3000/signin?google=expired',
      );
    });

    it('refuses Google accounts whose email Google has not verified, and blocked accounts', async () => {
      const unverified = await googleSignIn(
        `fake:${randomUUID()}:${uniqueEmail()}:false:X`,
      );
      expect(unverified.location).toBe(
        'http://localhost:3000/signin?google=unverified',
      );

      const { email } = await signedInAgent(app);
      await db
        .update(users)
        .set({ status: 'BLOCKED' })
        .where(eq(users.email, email));
      const blocked = await googleSignIn(
        `fake:${randomUUID()}:${email}:true:X`,
      );
      expect(blocked.location).toBe(
        'http://localhost:3000/signin?google=closed',
      );
    });

    it('only redirects back to pages on this site', async () => {
      const { location } = await googleSignIn(
        `fake:${randomUUID()}:${uniqueEmail()}:true:X`,
        '//evil.example/x',
      );
      expect(location).toBe('http://localhost:3000/');
    });
  });
});
