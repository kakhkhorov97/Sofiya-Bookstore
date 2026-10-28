import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type {
  ChangePasswordInput,
  PublicUser,
  SignInInput,
  SignUpInput,
  UpdateProfileInput,
} from '@sofiya/shared';
import bcrypt from 'bcryptjs';
import { eq, sql } from 'drizzle-orm';
import { pgErrorCode, UNIQUE_VIOLATION } from '../common/pg-error';
import { loadEnv } from '../config/env';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { users } from '../db/schema';

type UserRow = typeof users.$inferSelect;

export const toPublicUser = (u: UserRow): PublicUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  points: u.points,
  emailVerified: u.emailVerifiedAt !== null,
  createdAt: u.createdAt.toISOString(),
});

// Compared against when the email is unknown, so a wrong email and a wrong
// password take the same time and return the same message.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

@Injectable()
export class UsersService {
  private readonly rounds = loadEnv().BCRYPT_ROUNDS;

  constructor(@InjectDb() private readonly db: Db) {}

  async signUp(input: SignUpInput): Promise<UserRow> {
    const passwordHash = await bcrypt.hash(input.password, this.rounds);
    try {
      const [user] = await this.db
        .insert(users)
        // Only the three allowed fields; role, status and points use DB defaults.
        .values({
          email: input.email,
          displayName: input.displayName,
          passwordHash,
        })
        .returning();
      return user;
    } catch (err) {
      if (pgErrorCode(err) === UNIQUE_VIOLATION) {
        throw new ConflictException(
          'An account with this email already exists',
        );
      }
      throw err;
    }
  }

  async signIn(input: SignInInput): Promise<UserRow> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = ${input.email}`)
      .limit(1);
    const ok = await bcrypt.compare(
      input.password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    if (!user || !ok || user.status === 'DELETED') {
      throw new UnauthorizedException('Email or password is incorrect');
    }
    if (user.status === 'BLOCKED') {
      throw new ForbiddenException(
        'This account has been blocked. Please contact the store.',
      );
    }
    return user;
  }

  async findActive(id: string): Promise<UserRow | null> {
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    return user && user.status === 'ACTIVE' ? user : null;
  }

  // Ends every session issued before this moment and returns it (whole
  // seconds), so the caller can sign this browser in again at exactly that
  // time: one clock, so the new session is never older than the cutoff.
  async changePassword(
    user: UserRow,
    input: ChangePasswordInput,
  ): Promise<number> {
    const ok = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!ok) {
      throw new BadRequestException(
        user.googleSub
          ? 'The current password is incorrect. If you only ever used Google, set a password with "Forgot password" on the sign-in page.'
          : 'The current password is incorrect.',
      );
    }
    const passwordHash = await bcrypt.hash(input.newPassword, this.rounds);
    const cutoff = Math.floor(Date.now() / 1000);
    await this.db
      .update(users)
      .set({
        passwordHash,
        sessionsValidAfter: new Date(cutoff * 1000),
        updatedAt: sql`now()`,
      })
      .where(eq(users.id, user.id));
    return cutoff;
  }

  async updateProfile(id: string, input: UpdateProfileInput): Promise<UserRow> {
    const [user] = await this.db
      .update(users)
      .set({ displayName: input.displayName, updatedAt: sql`now()` })
      .where(eq(users.id, id))
      .returning();
    return user;
  }
}
