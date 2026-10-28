import { Inject, Injectable, Logger } from '@nestjs/common';
import type { OrderView } from '@sofiya/shared';
import { sql } from 'drizzle-orm';
import { loadEnv, webUrl } from '../config/env';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { MAILER, type Mailer } from '../mail/mailer';
import { orderEmail, type OrderEmailKind } from '../mail/templates';

// Tells customers what happened to their order. Sending happens in the
// background: a slow or failing email service never slows or breaks the
// order itself.
@Injectable()
export class OrderEmailsService {
  private readonly logger = new Logger(OrderEmailsService.name);
  private readonly env = loadEnv();
  private readonly pending = new Set<Promise<void>>();

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(MAILER) private readonly mailer: Mailer | null,
  ) {}

  notify(kind: OrderEmailKind, order: OrderView): void {
    if (!this.mailer) return;
    const job = this.send(kind, order)
      .catch((err: Error) =>
        this.logger.error(
          `Order ${order.id} "${kind}" email failed: ${err.message}`,
        ),
      )
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
  }

  // Tests wait for background emails with this.
  async flush(): Promise<void> {
    await Promise.all([...this.pending]);
  }

  private async send(kind: OrderEmailKind, order: OrderView): Promise<void> {
    const [user] = await this.db.execute<{
      email: string;
      display_name: string;
    }>(sql`SELECT email, display_name FROM users WHERE id = ${order.userId}`);
    if (!user) return;
    await this.mailer!.send(
      orderEmail(
        kind,
        user.email,
        user.display_name,
        order,
        `${webUrl(this.env)}/orders/${order.id}`,
        {
          bankName: this.env.BANK_NAME ?? null,
          accountNumber: this.env.BANK_ACCOUNT_NUMBER ?? null,
          accountHolder: this.env.BANK_ACCOUNT_HOLDER ?? null,
        },
      ),
    );
  }
}
