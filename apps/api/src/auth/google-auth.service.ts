import { Inject, Injectable } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import jwt from 'jsonwebtoken';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { loadEnv, webUrl } from '../config/env';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { users } from '../db/schema';
import { GOOGLE_CLIENT, type GoogleClient } from './google';

export const GOOGLE_STATE_COOKIE = 'sofiya_google';
const STATE_MINUTES = 10;

type UserRow = typeof users.$inferSelect;

// Why a Google sign-in did not finish; the sign-in page explains each one.
export class GoogleSignInError extends Error {
  constructor(
    readonly reason:
      'cancelled' | 'expired' | 'failed' | 'unverified' | 'closed',
  ) {
    super(reason);
  }
}

interface StateClaims {
  state: string;
  verifier: string;
  next: string;
}

// Only paths on this site, never "//evil.example" or "https://...".
export const safeNextPath = (next: unknown): string =>
  typeof next === 'string' && /^\/(?!\/)[^\\\s]*$/.test(next) ? next : '/';

const base64url = (b: Buffer) => b.toString('base64url');

@Injectable()
export class GoogleAuthService {
  private readonly env = loadEnv();

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(GOOGLE_CLIENT) private readonly google: GoogleClient | null,
  ) {}

  get enabled(): boolean {
    return this.google !== null;
  }

  // Google sends the browser back here; it goes through the website's
  // /api proxy so the session cookie is set on the website's domain.
  private get redirectUri(): string {
    return `${webUrl(this.env)}/api/auth/google/callback`;
  }

  private get secret(): string {
    if (!this.env.AUTH_SECRET) throw new Error('AUTH_SECRET is not set');
    return this.env.AUTH_SECRET;
  }

  // The Google URL to send the browser to, and the signed cookie that
  // remembers this attempt (CSRF state, PKCE verifier, where to go after).
  start(next: unknown): { url: string; cookie: string; maxAgeMs: number } {
    const state = base64url(randomBytes(24));
    const verifier = base64url(randomBytes(48));
    const codeChallenge = base64url(
      createHash('sha256').update(verifier).digest(),
    );
    const claims: StateClaims = { state, verifier, next: safeNextPath(next) };
    const cookie = jwt.sign(claims, this.secret, {
      algorithm: 'HS256',
      expiresIn: `${STATE_MINUTES}m`,
    });
    const url = this.google!.authUrl({
      state,
      codeChallenge,
      redirectUri: this.redirectUri,
    });
    return { url, cookie, maxAgeMs: STATE_MINUTES * 60_000 };
  }

  // Checks the callback belongs to the attempt this browser started, asks
  // Google who the user is, and returns our account plus where to go next.
  async finish(input: {
    code?: string;
    state?: string;
    error?: string;
    cookie?: string;
  }): Promise<{ user: UserRow; next: string }> {
    if (input.error) throw new GoogleSignInError('cancelled');
    let claims: StateClaims;
    try {
      claims = jwt.verify(input.cookie ?? '', this.secret, {
        algorithms: ['HS256'],
      }) as StateClaims;
    } catch {
      throw new GoogleSignInError('expired');
    }
    const a = Buffer.from(claims.state);
    const b = Buffer.from(input.state ?? '');
    if (!input.code || a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new GoogleSignInError('expired');
    }

    let profile;
    try {
      profile = await this.google!.profile({
        code: input.code,
        codeVerifier: claims.verifier,
        redirectUri: this.redirectUri,
      });
    } catch {
      throw new GoogleSignInError('failed');
    }
    if (!profile.emailVerified) throw new GoogleSignInError('unverified');

    const user = await this.findOrCreate(profile);
    return { user, next: claims.next };
  }

  private async findOrCreate(profile: {
    sub: string;
    email: string;
    name: string | null;
  }): Promise<UserRow> {
    return this.db.transaction(async (tx) => {
      const [bySub] = await tx
        .select()
        .from(users)
        .where(sql`${users.googleSub} = ${profile.sub}`);
      if (bySub) return this.usable(bySub);

      const [byEmail] = await tx
        .select()
        .from(users)
        .where(sql`lower(${users.email}) = ${profile.email}`)
        .for('update');
      if (byEmail) {
        this.usable(byEmail);
        // Google has proven this address belongs to the person signing in.
        // If our account never confirmed it, someone else may have created
        // it with their own password: cancel that password and its sessions
        // before linking (the owner can set a password via "Forgot password").
        const unconfirmed = byEmail.emailVerifiedAt === null;
        const [linked] = await tx
          .update(users)
          .set({
            googleSub: profile.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? sql`now()`,
            ...(unconfirmed
              ? {
                  passwordHash: await bcrypt.hash(
                    base64url(randomBytes(32)),
                    4,
                  ),
                  sessionsValidAfter: sql`date_trunc('second', now())`,
                }
              : {}),
            updatedAt: sql`now()`,
          })
          .where(sql`${users.id} = ${byEmail.id}`)
          .returning();
        return linked;
      }

      // New account. The random password can never be typed; the owner can
      // add a real one later with "Forgot password".
      const [created] = await tx
        .insert(users)
        .values({
          email: profile.email,
          displayName: (
            profile.name?.trim() || profile.email.split('@')[0]
          ).slice(0, 60),
          passwordHash: await bcrypt.hash(base64url(randomBytes(32)), 4),
          googleSub: profile.sub,
          emailVerifiedAt: sql`now()`,
        })
        .returning();
      return created;
    });
  }

  private usable(user: UserRow): UserRow {
    if (user.status !== 'ACTIVE') throw new GoogleSignInError('closed');
    return user;
  }
}
