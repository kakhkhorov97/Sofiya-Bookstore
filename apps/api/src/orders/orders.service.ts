import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AdminOrderStatusInput,
  canTransition,
  computeOrderTotals,
  CreateOrderInput,
  Currency,
  OrderListQuery,
  OrderStatus,
  OrderView,
  Page,
  PaymentMethod,
  TossConfirmInput,
  POINTS_PER_ORDER,
} from '@sofiya/shared';
import { createHash } from 'node:crypto';
import { sql, SQL } from 'drizzle-orm';
import { pgErrorCode, UNIQUE_VIOLATION } from '../common/pg-error';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { loadEnv } from '../config/env';
import {
  PAYMENT_GATEWAY,
  PaymentError,
  type PaymentGateway,
} from '../payments/gateway';
import { toPaymentView, type PaymentColumns } from '../payments/payment-view';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const MAX_QUANTITY_PER_FORMAT = 20;

interface OrderRow extends PaymentColumns {
  id: string;
  user_id: string;
  status: OrderStatus;
  currency: Currency;
  subtotal_cents: number;
  delivery_cents: number;
  total_cents: number;
  points_awarded: number;
  request_hash: string;
  payment_key: string | null;
  created_at: Date;
  updated_at: Date;
  items: {
    formatId: string;
    bookSlug: string;
    bookTitle: string;
    format: OrderView['items'][number]['format'];
    quantity: number;
    unitPrice: number;
  }[];
  [key: string]: unknown;
}

export interface CreateResult {
  order: OrderView;
  created: boolean;
}

// Same order lines in any order give the same hash. The currency and the
// payment method are part of the request, so reusing a key with another
// currency or method is a conflict.
export function hashLines(
  lines: Map<string, number>,
  currency: Currency,
  paymentMethod: PaymentMethod = 'BANK_TRANSFER',
): string {
  const canonical =
    `${currency}|${paymentMethod}|` +
    [...lines.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, qty]) => `${id}:${qty}`)
      .join(',');
  return createHash('sha256').update(canonical).digest('hex');
}

const toView = (r: OrderRow): OrderView => ({
  id: r.id,
  userId: r.user_id,
  status: r.status,
  currency: r.currency,
  subtotal: r.subtotal_cents,
  delivery: r.delivery_cents,
  total: r.total_cents,
  pointsAwarded: r.points_awarded,
  payment: toPaymentView(r),
  items: r.items ?? [],
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

const ORDER_SELECT = sql`
  SELECT o.*,
    coalesce((
      SELECT json_agg(json_build_object(
        'formatId', oi.format_id, 'bookSlug', b.slug, 'bookTitle', b.title,
        'format', bf.format, 'quantity', oi.quantity, 'unitPrice', oi.unit_price_cents
      ) ORDER BY b.title, bf.format)
      FROM order_items oi
      JOIN book_formats bf ON bf.id = oi.format_id
      JOIN books b ON b.id = bf.book_id
      WHERE oi.order_id = o.id
    ), '[]'::json) AS items
  FROM orders o`;

// Card confirmations stuck in CONFIRMING this long (a crash mid-request) may
// be retried; Toss's Idempotency-Key stops a double charge.
const STALE_CONFIRMING = sql`interval '2 minutes'`;

@Injectable()
export class OrdersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OrdersService.name);
  private readonly env = loadEnv();
  private expiryTimer?: NodeJS.Timeout;

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway | null,
  ) {}

  onModuleInit(): void {
    if (this.env.NODE_ENV === 'test') return;
    this.expiryTimer = setInterval(() => {
      this.expireUnpaidCardOrders().catch((err: Error) =>
        this.logger.warn(`Expiring unpaid orders failed: ${err.message}`),
      );
    }, 60_000);
    this.expiryTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.expiryTimer);
  }

  async create(userId: string, input: CreateOrderInput): Promise<CreateResult> {
    if (input.paymentMethod === 'CARD') {
      if (!this.gateway) {
        throw new ServiceUnavailableException(
          'Card payments are not available right now. Choose bank transfer instead.',
        );
      }
      if (!this.env.CARD_CURRENCIES.includes(input.currency)) {
        throw new BadRequestException(
          `Card payments are not available in ${input.currency}. Switch the currency or choose bank transfer.`,
        );
      }
    }
    const lines = new Map<string, number>();
    for (const l of input.lines) {
      lines.set(l.formatId, (lines.get(l.formatId) ?? 0) + l.quantity);
    }
    for (const qty of lines.values()) {
      if (qty > MAX_QUANTITY_PER_FORMAT) {
        throw new BadRequestException(
          `At most ${MAX_QUANTITY_PER_FORMAT} copies of one format per order`,
        );
      }
    }
    const requestHash = hashLines(lines, input.currency, input.paymentMethod);

    const replay = await this.findByKey(userId, input.idempotencyKey);
    if (replay) return this.replayResult(replay, requestHash);

    try {
      const orderId = await this.db.transaction((tx) =>
        this.insertOrder(
          tx,
          userId,
          input.idempotencyKey,
          requestHash,
          lines,
          input.currency,
          input.paymentMethod,
        ),
      );
      return { order: await this.getView(orderId), created: true };
    } catch (err) {
      // A parallel request with the same key won the race.
      if (pgErrorCode(err) === UNIQUE_VIOLATION) {
        const winner = await this.findByKey(userId, input.idempotencyKey);
        if (winner) return this.replayResult(winner, requestHash);
      }
      throw err;
    }
  }

  private replayResult(existing: OrderRow, requestHash: string): CreateResult {
    if (existing.request_hash !== requestHash) {
      throw new ConflictException(
        'This idempotency key was already used for a different order',
      );
    }
    return { order: toView(existing), created: false };
  }

  private async insertOrder(
    tx: Tx,
    userId: string,
    idempotencyKey: string,
    requestHash: string,
    lines: Map<string, number>,
    currency: Currency,
    paymentMethod: PaymentMethod,
  ): Promise<string> {
    const ids = [...lines.keys()].sort();
    // Lock the rows in a fixed order so concurrent checkouts cannot deadlock.
    const formats = await tx.execute<{
      id: string;
      price_cents: number;
      price_krw: number;
      stock: number | null;
      book_status: string;
    }>(sql`
      SELECT bf.id, bf.price_cents, bf.price_krw, bf.stock, b.status AS book_status
      FROM book_formats bf JOIN books b ON b.id = bf.book_id
      WHERE bf.id IN (${sql.join(
        ids.map((id) => sql`${id}`),
        sql`, `,
      )})
      ORDER BY bf.id
      FOR UPDATE OF bf`);

    const byId = new Map(formats.map((f) => [f.id, f]));
    const unavailable = ids.filter(
      (id) => byId.get(id)?.book_status !== 'LIVE',
    );
    if (unavailable.length) {
      throw new UnprocessableEntityException({
        message: 'Some items are not available',
        formatIds: unavailable,
      });
    }
    const short = ids.filter((id) => {
      const stock = byId.get(id)!.stock;
      return stock !== null && stock < lines.get(id)!;
    });
    if (short.length) {
      throw new ConflictException({
        message: 'Not enough stock',
        formatIds: short,
      });
    }

    for (const id of ids) {
      if (byId.get(id)!.stock !== null) {
        await tx.execute(sql`
          UPDATE book_formats SET stock = stock - ${lines.get(id)!}, updated_at = now()
          WHERE id = ${id}`);
      }
    }

    // Prices come from the database, never from the request
    // (legacy defect: the client sent itemPrice and the server trusted it).
    const unitPrice = (id: string) =>
      currency === 'KRW' ? byId.get(id)!.price_krw : byId.get(id)!.price_cents;
    const totals = computeOrderTotals(
      ids.map((id) => ({ unitPrice: unitPrice(id), quantity: lines.get(id)! })),
      currency,
    );

    const [order] = await tx.execute<{ id: string }>(sql`
      INSERT INTO orders (user_id, currency, subtotal_cents, delivery_cents, total_cents, idempotency_key, request_hash, payment_method)
      VALUES (${userId}, ${currency}, ${totals.subtotal}, ${totals.delivery}, ${totals.total}, ${idempotencyKey}, ${requestHash}, ${paymentMethod})
      RETURNING id`);

    await tx.execute(sql`
      INSERT INTO order_items (order_id, format_id, quantity, unit_price_cents)
      VALUES ${sql.join(
        ids.map(
          (id) =>
            sql`(${order.id}, ${id}, ${lines.get(id)!}, ${unitPrice(id)})`,
        ),
        sql`, `,
      )}`);

    return order.id;
  }

  private async findByKey(
    userId: string,
    key: string,
  ): Promise<OrderRow | undefined> {
    const rows = await this.db.execute<OrderRow>(
      sql`${ORDER_SELECT} WHERE o.user_id = ${userId} AND o.idempotency_key = ${key}`,
    );
    return rows[0];
  }

  private async getView(orderId: string): Promise<OrderView> {
    const rows = await this.db.execute<OrderRow>(
      sql`${ORDER_SELECT} WHERE o.id = ${orderId}`,
    );
    if (!rows[0]) throw new NotFoundException('Order not found');
    return toView(rows[0]);
  }

  async list(query: OrderListQuery, userId?: string): Promise<Page<OrderView>> {
    const where: SQL[] = [sql`true`];
    if (userId) where.push(sql`o.user_id = ${userId}`);
    if (query.status) where.push(sql`o.status = ${query.status}`);
    const cond = sql.join(where, sql` AND `);
    const [rows, count] = await Promise.all([
      this.db.execute<OrderRow>(sql`
        ${ORDER_SELECT} WHERE ${cond}
        ORDER BY o.created_at DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      this.db.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM orders o WHERE ${cond}`,
      ),
    ]);
    return {
      items: rows.map(toView),
      total: Number(count[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  // Customers only ever see their own orders; anyone else's is a 404.
  async getForUser(userId: string, orderId: string): Promise<OrderView> {
    const order = await this.getView(orderId);
    if (order.userId !== userId) throw new NotFoundException('Order not found');
    return order;
  }

  async cancelByCustomer(userId: string, orderId: string): Promise<OrderView> {
    await this.db.transaction(async (tx) => {
      const updated = await tx.execute(sql`
        UPDATE orders SET status = 'CANCELLED', updated_at = now()
        WHERE id = ${orderId} AND user_id = ${userId} AND status = 'PAUSED'
          AND payment_status = 'UNPAID'
        RETURNING id`);
      if (updated.length === 0) {
        const own = await tx.execute(
          sql`SELECT 1 FROM orders WHERE id = ${orderId} AND user_id = ${userId}`,
        );
        if (own.length === 0) throw new NotFoundException('Order not found');
        throw new ConflictException('Only paused orders can be cancelled');
      }
      await this.restoreStock(tx, orderId);
    });
    return this.getView(orderId);
  }

  // The browser returns from the Toss window with a paymentKey. The order is
  // claimed (UNPAID -> CONFIRMING) so two tabs cannot confirm it at once,
  // then Toss approves the stored total, never an amount from the browser.
  async confirmCardPayment(
    userId: string,
    orderId: string,
    input: TossConfirmInput,
  ): Promise<OrderView> {
    if (!this.gateway) {
      throw new ServiceUnavailableException(
        'Card payments are not available right now.',
      );
    }
    const [claimed] = await this.db.execute<{
      total_cents: number;
      currency: Currency;
    }>(sql`
      UPDATE orders SET payment_status = 'CONFIRMING', payment_error = NULL, updated_at = now()
      WHERE id = ${orderId} AND user_id = ${userId}
        AND payment_method = 'CARD' AND status = 'PAUSED'
        AND (payment_status = 'UNPAID'
             OR (payment_status = 'CONFIRMING' AND updated_at < now() - ${STALE_CONFIRMING}))
      RETURNING total_cents, currency`);
    if (!claimed) return this.explainUnclaimable(userId, orderId, input);

    const fail = async (message: string) => {
      await this.db.execute(sql`
        UPDATE orders SET payment_status = 'UNPAID', payment_error = ${message}, updated_at = now()
        WHERE id = ${orderId} AND payment_status = 'CONFIRMING'`);
    };

    if (input.amount !== claimed.total_cents) {
      await fail('The payment amount did not match the order total.');
      throw new BadRequestException(
        'The payment amount does not match the order total.',
      );
    }

    let payment;
    try {
      payment = await this.gateway.confirm({
        paymentKey: input.paymentKey,
        orderId,
        amount: claimed.total_cents,
        currency: claimed.currency,
      });
    } catch (err) {
      const message =
        err instanceof PaymentError ? err.message : 'The payment failed.';
      await fail(message);
      if (err instanceof PaymentError && err.fromProvider) {
        throw new BadRequestException({ message, code: err.code });
      }
      throw new BadGatewayException(message);
    }

    // Belt and braces: Toss approved exactly this order and amount.
    if (
      payment.orderId !== orderId ||
      payment.totalAmount !== claimed.total_cents ||
      payment.status !== 'DONE'
    ) {
      await this.gateway
        .cancel(
          payment.paymentKey,
          'Payment did not match the order',
          `mismatch-${orderId}`,
        )
        .catch(() => undefined);
      await fail('The payment did not match the order and was cancelled.');
      throw new BadGatewayException(
        'The payment did not match the order and was cancelled. You have not been charged.',
      );
    }

    await this.db.transaction(async (tx) => {
      const [row] = await tx.execute<{ user_id: string }>(sql`
        UPDATE orders SET payment_status = 'PAID', payment_key = ${payment.paymentKey},
          paid_at = ${payment.approvedAt ?? new Date().toISOString()},
          receipt_url = ${payment.receiptUrl}, payment_error = NULL,
          status = 'IN_PROCESS', updated_at = now()
        WHERE id = ${orderId} AND payment_status = 'CONFIRMING'
        RETURNING user_id`);
      // A paid order is confirmed straight away, so it earns its point now.
      if (row) await this.awardPoints(tx, orderId, row.user_id);
    });
    return this.getView(orderId);
  }

  // Why a confirmation could not claim the order, or the already-paid order
  // when the same payment is confirmed twice (a refreshed success page).
  private async explainUnclaimable(
    userId: string,
    orderId: string,
    input: TossConfirmInput,
  ): Promise<OrderView> {
    const [row] = await this.db.execute<OrderRow>(
      sql`${ORDER_SELECT} WHERE o.id = ${orderId} AND o.user_id = ${userId}`,
    );
    if (!row) throw new NotFoundException('Order not found');
    if (row.payment_status === 'PAID' && row.payment_key === input.paymentKey) {
      return toView(row);
    }
    if (row.payment_method !== 'CARD') {
      throw new BadRequestException('This order is paid by bank transfer.');
    }
    if (row.payment_status === 'PAID') {
      throw new ConflictException('This order has already been paid.');
    }
    if (row.payment_status === 'CONFIRMING') {
      throw new ConflictException(
        'This payment is already being confirmed. Refresh in a moment.',
      );
    }
    throw new ConflictException(
      `This order was cancelled, so it can no longer be paid. Unpaid card orders are cancelled after ${this.env.CARD_PAYMENT_TIMEOUT_MINUTES} minutes.`,
    );
  }

  // Unpaid card orders hold stock, so they are cancelled after a while.
  // Orders mid-confirmation are left alone.
  async expireUnpaidCardOrders(): Promise<number> {
    return this.db.transaction(async (tx) => {
      const expired = await tx.execute<{ id: string }>(sql`
        UPDATE orders SET status = 'CANCELLED', updated_at = now(),
          payment_error = 'Not paid in time'
        WHERE status = 'PAUSED' AND payment_method = 'CARD' AND payment_status = 'UNPAID'
          AND created_at < now() - make_interval(mins => ${this.env.CARD_PAYMENT_TIMEOUT_MINUTES})
        RETURNING id`);
      for (const { id } of expired) await this.restoreStock(tx, id);
      if (expired.length) {
        this.logger.log(`Cancelled ${expired.length} unpaid card order(s)`);
      }
      return expired.length;
    });
  }

  async setStatusByAdmin(
    orderId: string,
    input: AdminOrderStatusInput,
  ): Promise<OrderView> {
    if (!canTransition(input.expectedStatus, input.status)) {
      throw new ConflictException(
        `An order cannot move from ${input.expectedStatus} to ${input.status}`,
      );
    }
    const [current] = await this.db.execute<{
      status: OrderStatus;
      payment_method: PaymentMethod;
      payment_status: string;
      payment_key: string | null;
    }>(sql`
      SELECT status, payment_method, payment_status, payment_key FROM orders WHERE id = ${orderId}`);
    if (!current) throw new NotFoundException('Order not found');
    if (current.status !== input.expectedStatus) {
      throw new ConflictException(
        'The order changed since you loaded it. Refresh and try again.',
      );
    }
    const card = current.payment_method === 'CARD';
    if (
      input.status === 'IN_PROCESS' &&
      card &&
      current.payment_status !== 'PAID'
    ) {
      throw new ConflictException(
        'This order is waiting for the customer to pay by card.',
      );
    }
    if (
      input.status === 'CANCELLED' &&
      current.payment_status === 'CONFIRMING'
    ) {
      throw new ConflictException(
        'A card payment for this order is being confirmed. Try again in a minute.',
      );
    }
    // Cancelling a paid card order refunds it through Toss first; if the
    // refund fails, the order stays as it is.
    if (
      input.status === 'CANCELLED' &&
      card &&
      current.payment_status === 'PAID' &&
      current.payment_key
    ) {
      if (!this.gateway) {
        throw new ServiceUnavailableException(
          'Card refunds are not available right now, so the order was not cancelled.',
        );
      }
      try {
        await this.gateway.cancel(
          current.payment_key,
          'Order cancelled by the store',
          `refund-${orderId}`,
        );
      } catch (err) {
        const message =
          err instanceof PaymentError ? err.message : 'The refund failed.';
        throw new BadGatewayException(
          `The refund failed, so the order was not cancelled: ${message}`,
        );
      }
      await this.db.execute(sql`
        UPDATE orders SET payment_status = 'REFUNDED', updated_at = now() WHERE id = ${orderId}`);
    }

    await this.db.transaction(async (tx) => {
      const [row] = await tx.execute<{
        user_id: string;
        points_awarded: number;
      }>(sql`
        UPDATE orders SET status = ${input.status}, updated_at = now()
        WHERE id = ${orderId} AND status = ${input.expectedStatus}
        RETURNING user_id, points_awarded`);
      if (!row) {
        const exists = await tx.execute(
          sql`SELECT 1 FROM orders WHERE id = ${orderId}`,
        );
        if (exists.length === 0) throw new NotFoundException('Order not found');
        throw new ConflictException(
          'The order changed since you loaded it. Refresh and try again.',
        );
      }

      if (input.status === 'IN_PROCESS') {
        await this.awardPoints(tx, orderId, row.user_id);
        // Confirming a bank-transfer order means the money has arrived.
        await tx.execute(sql`
          UPDATE orders SET payment_status = 'PAID', paid_at = now()
          WHERE id = ${orderId} AND payment_method = 'BANK_TRANSFER' AND payment_status = 'UNPAID'`);
      }

      if (input.status === 'CANCELLED') {
        await this.restoreStock(tx, orderId);
        if (row.points_awarded > 0) {
          await tx.execute(sql`
            UPDATE users SET points = GREATEST(points - ${row.points_awarded}, 0), updated_at = now()
            WHERE id = ${row.user_id}`);
          await tx.execute(
            sql`UPDATE orders SET points_awarded = 0 WHERE id = ${orderId}`,
          );
        }
      }
    });
    return this.getView(orderId);
  }

  // Once per order (legacy defect: toggling the status farmed points).
  private async awardPoints(
    tx: Tx,
    orderId: string,
    userId: string,
  ): Promise<void> {
    const awarded = await tx.execute(sql`
      UPDATE orders SET points_awarded = ${POINTS_PER_ORDER}
      WHERE id = ${orderId} AND points_awarded = 0
      RETURNING id`);
    if (awarded.length === 0) return;
    await tx.execute(sql`
      UPDATE users SET points = points + ${POINTS_PER_ORDER}, updated_at = now()
      WHERE id = ${userId}`);
  }

  private async restoreStock(tx: Tx, orderId: string): Promise<void> {
    await tx.execute(sql`
      UPDATE book_formats bf
      SET stock = bf.stock + oi.quantity, updated_at = now()
      FROM order_items oi
      WHERE oi.order_id = ${orderId} AND bf.id = oi.format_id AND bf.stock IS NOT NULL`);
  }
}
