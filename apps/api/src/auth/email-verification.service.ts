import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { loadEnv, webUrl } from '../config/env';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { MAILER, type Mailer } from '../mail/mailer';
import { confirmEmailEmail } from '../mail/templates';
import { hashToken, newToken } from './tokens';

const LINK_HOURS = 24;
// One confirmation email per account per minute.
const RESEND_AFTER = sql`interval '1 minute'`;

interface Account {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: Date | null;
}

@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);
  private readonly env = loadEnv();

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(MAILER) private readonly mailer: Mailer | null,
  ) {}

  // Sends the "Confirm your email" link. Without an email service nobody
  // could ever confirm, so the address is accepted as it is instead.
  // Returns whether the address is confirmed now.
  async start(user: Account): Promise<boolean> {
    if (user.emailVerifiedAt) return true;
    if (!this.mailer) {
      await this.db.execute(
        sql`UPDATE users SET email_verified_at = now() WHERE id = ${user.id}`,
      );
      return true;
    }
    const [recent] = await this.db.execute(sql`
      SELECT 1 FROM email_verification_tokens
      WHERE user_id = ${user.id} AND created_at > now() - ${RESEND_AFTER}`);
    if (recent) return false;

    const { token, hash } = newToken();
    await this.db.transaction(async (tx) => {
      await tx.execute(
        sql`DELETE FROM email_verification_tokens WHERE user_id = ${user.id}`,
      );
      await tx.execute(sql`
        INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${hash}, now() + make_interval(hours => ${LINK_HOURS}))`);
    });
    const link = `${webUrl(this.env)}/verify-email?token=${encodeURIComponent(token)}`;
    try {
      await this.mailer.send(
        confirmEmailEmail(user.email, user.displayName, link, LINK_HOURS),
      );
    } catch (err) {
      this.logger.error(
        `Confirmation email to user ${user.id} failed: ${(err as Error).message}`,
      );
    }
    return false;
  }

  // The link may be opened in another browser, so it needs no session.
  async confirm(token: string): Promise<void> {
    const [row] = await this.db.execute<{ user_id: string }>(sql`
      DELETE FROM email_verification_tokens
      WHERE token_hash = ${hashToken(token)} AND expires_at > now()
      RETURNING user_id`);
    if (!row) {
      throw new BadRequestException(
        'This confirmation link is invalid or has expired. Sign in and ask for a new one.',
      );
    }
    await this.db.execute(sql`
      UPDATE users SET email_verified_at = coalesce(email_verified_at, now()), updated_at = now()
      WHERE id = ${row.user_id}`);
  }
}
