import type { CookieOptions } from 'express';
import jwt from 'jsonwebtoken';
import type { Env } from '../config/env';

export const SESSION_COOKIE = 'sofiya_session';
const SESSION_DAYS = 7;

// The token carries only the user id. Role and status are read from the
// database on every request, so blocking a user or changing a role takes
// effect immediately (legacy defect: the whole member document was the JWT).
interface SessionClaims {
  sub: string;
}

function secret(env: Env): string {
  if (!env.AUTH_SECRET) throw new Error('AUTH_SECRET is not set');
  return env.AUTH_SECRET;
}

export function signSession(env: Env, userId: string): string {
  return jwt.sign({}, secret(env), {
    subject: userId,
    expiresIn: `${SESSION_DAYS}d`,
    algorithm: 'HS256',
  });
}

export function verifySession(env: Env, token: string): string | null {
  try {
    const claims = jwt.verify(token, secret(env), {
      algorithms: ['HS256'],
    }) as SessionClaims;
    return typeof claims.sub === 'string' ? claims.sub : null;
  } catch {
    return null;
  }
}

// httpOnly so page scripts cannot read it (legacy: httpOnly false).
// SameSite=Lax: the web app proxies /api to the API, so requests are
// same-site and the cookie is never sent on cross-site POSTs.
export function sessionCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}
