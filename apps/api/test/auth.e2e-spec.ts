import { INestApplication } from '@nestjs/common';
import type { PublicUser } from '@sofiya/shared';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { App } from 'supertest/types';
import { users } from '../src/db/schema';
import {
  createTestApp,
  signedInAgent,
  testDb,
  uniqueEmail,
  WEB_ORIGIN,
} from './fixtures';

const sessionCookie = (res: request.Response) =>
  ([] as string[])
    .concat(res.headers['set-cookie'] ?? [])
    .find((c) => c.startsWith('sofiya_session='));

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const handle = testDb();
  const post = (path: string) =>
    request(app.getHttpServer()).post(path).set('Origin', WEB_ORIGIN);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  it('signs up and sets an httpOnly, SameSite=Lax session cookie', async () => {
    const res = await post('/api/auth/signup')
      .send({
        email: uniqueEmail(),
        password: 'long enough',
        displayName: 'Ada',
      })
      .expect(201);
    const user = res.body as PublicUser;
    expect(user.role).toBe('USER');
    expect(user.points).toBe(0);
    expect(res.body).not.toHaveProperty('passwordHash');

    const cookie = sessionCookie(res)!;
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('LEGACY: the session token holds only the user id, not the member document', async () => {
    const res = await post('/api/auth/signup')
      .send({
        email: uniqueEmail(),
        password: 'long enough',
        displayName: 'Ada',
      })
      .expect(201);
    const token = sessionCookie(res)!.split(';')[0].split('=')[1];
    const claims = jwt.decode(token) as Record<string, unknown>;
    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sub']);
  });

  it('LEGACY: sign-up cannot set role, status or points (mass assignment)', async () => {
    const email = uniqueEmail();
    await post('/api/auth/signup')
      .send({
        email,
        password: 'long enough',
        displayName: 'Mallory',
        role: 'ADMIN',
        points: 9999,
      })
      .expect(400);
    const rows = await handle.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    expect(rows).toHaveLength(0);
  });

  it('rejects a duplicate email, ignoring case', async () => {
    const email = uniqueEmail();
    const body = { password: 'long enough', displayName: 'Ada' };
    await post('/api/auth/signup')
      .send({ ...body, email })
      .expect(201);
    await post('/api/auth/signup')
      .send({ ...body, email: email.toUpperCase() })
      .expect(409);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { email } = await signedInAgent(app);
    const wrong = await post('/api/auth/signin')
      .send({ email, password: 'not the password' })
      .expect(401);
    const unknown = await post('/api/auth/signin')
      .send({ email: uniqueEmail(), password: 'whatever' })
      .expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('signs in with the right password, case-insensitively by email', async () => {
    const { email, password } = await signedInAgent(app);
    await post('/api/auth/signin')
      .send({ email: email.toUpperCase(), password })
      .expect(200);
  });

  it('protects /me and returns the profile with a session', async () => {
    await request(app.getHttpServer()).get('/api/me').expect(401);
    const { agent, email } = await signedInAgent(app);
    const res = await agent.get('/api/me').expect(200);
    expect((res.body as PublicUser).email).toBe(email);
  });

  it('rejects a tampered session token', async () => {
    const forged = jwt.sign({}, 'some-other-secret-of-at-least-32-chars!!', {
      subject: '00000000-0000-0000-0000-000000000000',
    });
    await request(app.getHttpServer())
      .get('/api/me')
      .set('Cookie', `sofiya_session=${forged}`)
      .expect(401);
  });

  it('LEGACY: profile updates accept only the display name (mass assignment)', async () => {
    const { agent, email } = await signedInAgent(app);
    await agent
      .patch('/api/me')
      .set('Origin', WEB_ORIGIN)
      .send({ displayName: 'New Name' })
      .expect(200);
    await agent
      .patch('/api/me')
      .set('Origin', WEB_ORIGIN)
      .send({
        displayName: 'Sneaky',
        role: 'ADMIN',
        points: 500,
        status: 'ACTIVE',
      })
      .expect(400);
    const [row] = await handle.db
      .select()
      .from(users)
      .where(eq(users.email, email));
    expect(row).toMatchObject({
      displayName: 'New Name',
      role: 'USER',
      points: 0,
    });
  });

  it('cuts off a blocked user immediately, even with a valid session', async () => {
    const { agent, email, password } = await signedInAgent(app);
    await agent.get('/api/me').expect(200);
    await handle.db
      .update(users)
      .set({ status: 'BLOCKED' })
      .where(eq(users.email, email));
    await agent.get('/api/me').expect(401);
    await post('/api/auth/signin').send({ email, password }).expect(403);
  });

  it('signs out by clearing the cookie', async () => {
    const { agent } = await signedInAgent(app);
    await agent.post('/api/auth/signout').set('Origin', WEB_ORIGIN).expect(204);
    await agent.get('/api/me').expect(401);
  });

  it('refuses data-changing requests from other origins', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/signup')
      .set('Origin', 'https://evil.example')
      .send({
        email: uniqueEmail(),
        password: 'long enough',
        displayName: 'Eve',
      })
      .expect(403);
  });
});
