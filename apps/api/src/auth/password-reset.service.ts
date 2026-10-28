import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { sql } from 'drizzle-orm';
import { createHash, randomBytes } from 'node:crypto';
import { loadEnv, webUrl } from '../config/env';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { MAILER, type Mailer } from '../mail/mailer';
import { passwordResetEmail } from '../mail/templates';

const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex');

// One reset email per account per minute, whatever the request rate.
const RESEND_AFTER = sql`interval '1 minute'`;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(MAILER) private readonly mailer: Mailer | null,
  ) {}

  // Sends a reset link if the email belongs to an active account. The caller
  // answers the same way either way, so nobody learns who has an account.
  async request(email: string): Promise<void> {
    if (!this.mailer) {
      throw new ServiceUnavailableException(
        'Password reset by email is not available right now. Please contact the store.',
      );
    }
    const [user] = await this.db.execute<{
      id: string;
      email: string;
      display_name: string;
      recent: boolean;
    }>(sql`
      SELECT u.id, u.email, u.display_name,
        EXISTS (SELECT 1 FROM password_reset_tokens t
                WHERE t.user_id = u.id AND t.created_at > now() - ${RESEND_AFTER}) AS recent
      FROM users u
      WHERE lower(u.email) = ${email} AND u.status = 'ACTIVE'`);
    if (!user || user.recent) return;

    const token = randomBytes(32).toString('base64url');
    const minutes = this.env.PASSWORD_RESET_MINUTES;
    await this.db.transaction(async (tx) => {
      // Only the newest link works.
      await tx.execute(
        sql`DELETE FROM password_reset_tokens WHERE user_id = ${user.id}`,
      );
      await tx.execute(sql`
        INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${hashToken(token)}, now() + make_interval(mins => ${minutes}))`);
    });
    const link = `${webUrl(this.env)}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.mailer.send(
        passwordResetEmail(user.email, user.display_name, link, minutes),
      );
    } catch (err) {
      this.logger.error(
        `Reset email to user ${user.id} failed: ${(err as Error).message}`,
      );
    }
  }

  // Sets the new password, uses up the link and signs out every session.
  async reset(token: string, password: string): Promise<void> {
    const passwordHash = await bcrypt.hash(password, this.env.BCRYPT_ROUNDS);
    await this.db.transaction(async (tx) => {
      const [row] = await tx.execute<{ id: string; user_id: string }>(sql`
        SELECT t.id, t.user_id FROM password_reset_tokens t
        JOIN users u ON u.id = t.user_id
        WHERE t.token_hash = ${hashToken(token)} AND t.used_at IS NULL
          AND t.expires_at > now() AND u.status = 'ACTIVE'
        FOR UPDATE OF t`);
      if (!row) {
        throw new BadRequestException(
          'This reset link is invalid or has expired. Ask for a new one.',
        );
      }
      // Whole seconds, like the session's issued-at time.
      await tx.execute(sql`
        UPDATE users SET password_hash = ${passwordHash},
          sessions_valid_after = date_trunc('second', now()), updated_at = now()
        WHERE id = ${row.user_id}`);
      await tx.execute(
        sql`DELETE FROM password_reset_tokens WHERE user_id = ${row.user_id}`,
      );
    });
  }
}
