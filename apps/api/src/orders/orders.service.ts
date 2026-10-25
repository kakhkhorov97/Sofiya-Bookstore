import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AdminOrderStatusInput,
  canTransition,
  computeOrderTotals,
  CreateOrderInput,
  OrderListQuery,
  OrderStatus,
  OrderView,
  Page,
  POINTS_PER_ORDER,
} from '@sofiya/shared';
import { createHash } from 'node:crypto';
import { sql, SQL } from 'drizzle-orm';
import { pgErrorCode, UNIQUE_VIOLATION } from '../common/pg-error';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const MAX_QUANTITY_PER_FORMAT = 20;

interface OrderRow {
  id: string;
  user_id: string;
  status: OrderStatus;
  subtotal_cents: number;
  delivery_cents: number;
  total_cents: number;
  points_awarded: number;
  request_hash: string;
  created_at: Date;
  updated_at: Date;
  items: {
    formatId: string;
    bookSlug: string;
    bookTitle: string;
    format: OrderView['items'][number]['format'];
    quantity: number;
    unitPriceCents: number;
  }[];
  [key: string]: unknown;
}

export interface CreateResult {
  order: OrderView;
  created: boolean;
}

// Same order lines in any order give the same hash.
export function hashLines(lines: Map<string, number>): string {
  const canonical = [...lines.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, qty]) => `${id}:${qty}`)
    .join(',');
  return createHash('sha256').update(canonical).digest('hex');
}

const toView = (r: OrderRow): OrderView => ({
  id: r.id,
  userId: r.user_id,
  status: r.status,
  subtotalCents: r.subtotal_cents,
  deliveryCents: r.delivery_cents,
  totalCents: r.total_cents,
  pointsAwarded: r.points_awarded,
  items: r.items ?? [],
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

const ORDER_SELECT = sql`
  SELECT o.*,
    coalesce((
      SELECT json_agg(json_build_object(
        'formatId', oi.format_id, 'bookSlug', b.slug, 'bookTitle', b.title,
        'format', bf.format, 'quantity', oi.quantity, 'unitPriceCents', oi.unit_price_cents
      ) ORDER BY b.title, bf.format)
      FROM order_items oi
      JOIN book_formats bf ON bf.id = oi.format_id
      JOIN books b ON b.id = bf.book_id
      WHERE oi.order_id = o.id
    ), '[]'::json) AS items
  FROM orders o`;

@Injectable()
export class OrdersService {
  constructor(@InjectDb() private readonly db: Db) {}

  async create(userId: string, input: CreateOrderInput): Promise<CreateResult> {
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
    const requestHash = hashLines(lines);

    const replay = await this.findByKey(userId, input.idempotencyKey);
    if (replay) return this.replayResult(replay, requestHash);

    try {
      const orderId = await this.db.transaction((tx) =>
        this.insertOrder(tx, userId, input.idempotencyKey, requestHash, lines),
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
  ): Promise<string> {
    const ids = [...lines.keys()].sort();
    // Lock the rows in a fixed order so concurrent checkouts cannot deadlock.
    const formats = await tx.execute<{
      id: string;
      price_cents: number;
      stock: number | null;
      book_status: string;
    }>(sql`
      SELECT bf.id, bf.price_cents, bf.stock, b.status AS book_status
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
    const totals = computeOrderTotals(
      ids.map((id) => ({
        unitPriceCents: byId.get(id)!.price_cents,
        quantity: lines.get(id)!,
      })),
    );

    const [order] = await tx.execute<{ id: string }>(sql`
      INSERT INTO orders (user_id, subtotal_cents, delivery_cents, total_cents, idempotency_key, request_hash)
      VALUES (${userId}, ${totals.subtotalCents}, ${totals.deliveryCents}, ${totals.totalCents}, ${idempotencyKey}, ${requestHash})
      RETURNING id`);

    await tx.execute(sql`
      INSERT INTO order_items (order_id, format_id, quantity, unit_price_cents)
      VALUES ${sql.join(
        ids.map(
          (id) =>
            sql`(${order.id}, ${id}, ${lines.get(id)!}, ${byId.get(id)!.price_cents})`,
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

  async setStatusByAdmin(
    orderId: string,
    input: AdminOrderStatusInput,
  ): Promise<OrderView> {
    if (!canTransition(input.expectedStatus, input.status)) {
      throw new ConflictException(
        `An order cannot move from ${input.expectedStatus} to ${input.status}`,
      );
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

      if (input.status === 'IN_PROCESS' && row.points_awarded === 0) {
        // Award once per order (legacy defect: toggling the status farmed points).
        await tx.execute(sql`
          UPDATE orders SET points_awarded = ${POINTS_PER_ORDER} WHERE id = ${orderId}`);
        await tx.execute(sql`
          UPDATE users SET points = points + ${POINTS_PER_ORDER}, updated_at = now()
          WHERE id = ${row.user_id}`);
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

  private async restoreStock(tx: Tx, orderId: string): Promise<void> {
    await tx.execute(sql`
      UPDATE book_formats bf
      SET stock = bf.stock + oi.quantity, updated_at = now()
      FROM order_items oi
      WHERE oi.order_id = ${orderId} AND bf.id = oi.format_id AND bf.stock IS NOT NULL`);
  }
}
