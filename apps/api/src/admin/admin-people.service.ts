import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BOOK_STATUSES,
  ORDER_STATUSES,
  type AdminMember,
  type AdminMemberListQuery,
  type AdminOrder,
  type AdminOrderListQuery,
  type AdminOverview,
  type BookFormat,
  type BookStatus,
  type Currency,
  type MemberStatusInput,
  type OrderStatus,
  type Page,
  type Prices,
} from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import { IndexJobService } from '../ai/index-job.service';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';

const LOW_STOCK = 5;
const escapeLike = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

@Injectable()
export class AdminPeopleService {
  constructor(
    @InjectDb() private readonly db: Db,
    private readonly index: IndexJobService,
  ) {}

  async orders(query: AdminOrderListQuery): Promise<Page<AdminOrder>> {
    const where: SQL[] = [sql`true`];
    if (query.status) where.push(sql`o.status = ${query.status}`);
    if (query.q) {
      const like = escapeLike(query.q);
      where.push(
        sql`(u.email ILIKE ${like} ESCAPE '\\' OR u.display_name ILIKE ${like} ESCAPE '\\' OR o.id::text ILIKE ${like} ESCAPE '\\')`,
      );
    }
    const cond = sql.join(where, sql` AND `);
    const [rows, count] = await Promise.all([
      this.db.execute<{
        id: string;
        user_id: string;
        status: OrderStatus;
        currency: Currency;
        subtotal_cents: number;
        delivery_cents: number;
        total_cents: number;
        points_awarded: number;
        created_at: Date;
        updated_at: Date;
        display_name: string;
        email: string;
        items: AdminOrder['items'];
      }>(sql`
        SELECT o.*, u.display_name, u.email,
          coalesce((
            SELECT json_agg(json_build_object(
              'formatId', oi.format_id, 'bookSlug', b.slug, 'bookTitle', b.title,
              'format', bf.format, 'quantity', oi.quantity, 'unitPrice', oi.unit_price_cents
            ) ORDER BY b.title)
            FROM order_items oi
            JOIN book_formats bf ON bf.id = oi.format_id
            JOIN books b ON b.id = bf.book_id
            WHERE oi.order_id = o.id
          ), '[]'::json) AS items
        FROM orders o JOIN users u ON u.id = o.user_id
        WHERE ${cond}
        ORDER BY o.created_at DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      this.db.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM orders o JOIN users u ON u.id = o.user_id WHERE ${cond}`,
      ),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        currency: r.currency,
        subtotal: r.subtotal_cents,
        delivery: r.delivery_cents,
        total: r.total_cents,
        pointsAwarded: r.points_awarded,
        items: r.items,
        createdAt: new Date(r.created_at).toISOString(),
        updatedAt: new Date(r.updated_at).toISOString(),
        customer: { name: r.display_name, email: r.email },
      })),
      total: Number(count[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async members(query: AdminMemberListQuery): Promise<Page<AdminMember>> {
    const where: SQL[] = [sql`u.status <> 'DELETED'`];
    if (query.status) where.push(sql`u.status = ${query.status}`);
    if (query.q) {
      const like = escapeLike(query.q);
      where.push(
        sql`(u.email ILIKE ${like} ESCAPE '\\' OR u.display_name ILIKE ${like} ESCAPE '\\')`,
      );
    }
    const cond = sql.join(where, sql` AND `);
    const [rows, count] = await Promise.all([
      this.db.execute<{
        id: string;
        email: string;
        display_name: string;
        role: AdminMember['role'];
        status: AdminMember['status'];
        points: number;
        created_at: Date;
        order_count: number;
        spent_usd: number;
        spent_krw: number;
      }>(sql`
        SELECT u.id, u.email, u.display_name, u.role, u.status, u.points, u.created_at,
          count(o.id)::int AS order_count,
          coalesce(sum(o.total_cents) FILTER (WHERE o.currency = 'USD' AND o.status IN ('IN_PROCESS', 'DELIVERED')), 0)::int AS spent_usd,
          coalesce(sum(o.total_cents) FILTER (WHERE o.currency = 'KRW' AND o.status IN ('IN_PROCESS', 'DELIVERED')), 0)::int AS spent_krw
        FROM users u LEFT JOIN orders o ON o.user_id = u.id
        WHERE ${cond}
        GROUP BY u.id
        ORDER BY u.created_at DESC
        LIMIT ${query.limit} OFFSET ${(query.page - 1) * query.limit}`),
      this.db.execute<{ total: string }>(
        sql`SELECT count(*) AS total FROM users u WHERE ${cond}`,
      ),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        email: r.email,
        displayName: r.display_name,
        role: r.role,
        status: r.status,
        points: r.points,
        orderCount: r.order_count,
        spent: { USD: r.spent_usd, KRW: r.spent_krw },
        createdAt: new Date(r.created_at).toISOString(),
      })),
      total: Number(count[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  // Blocking takes effect on the member's next request: sessions re-read
  // the status from the database every time.
  async setMemberStatus(
    adminId: string,
    memberId: string,
    input: MemberStatusInput,
  ): Promise<void> {
    if (adminId === memberId) {
      throw new BadRequestException('You cannot change your own status.');
    }
    const [member] = await this.db.execute<{ role: string }>(
      sql`SELECT role FROM users WHERE id = ${memberId} AND status <> 'DELETED'`,
    );
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'ADMIN') {
      throw new ForbiddenException('Admins cannot be blocked here.');
    }
    await this.db.execute(
      sql`UPDATE users SET status = ${input.status}, updated_at = now() WHERE id = ${memberId}`,
    );
  }

  async overview(): Promise<AdminOverview> {
    const [
      orderRows,
      bookRows,
      lowStock,
      [members],
      embeddings,
      recent,
      unanswered,
    ] = await Promise.all([
      this.db.execute<{
        status: OrderStatus;
        currency: Currency;
        n: number;
        revenue: number;
      }>(sql`
          SELECT status, currency, count(*)::int AS n, coalesce(sum(total_cents), 0)::int AS revenue
          FROM orders GROUP BY status, currency`),
      this.db.execute<{ status: BookStatus; n: number }>(
        sql`SELECT status, count(*)::int AS n FROM books GROUP BY status`,
      ),
      this.db.execute<{
        book_id: string;
        slug: string;
        title: string;
        format: BookFormat;
        stock: number;
      }>(sql`
          SELECT b.id AS book_id, b.slug, b.title, bf.format, bf.stock
          FROM book_formats bf JOIN books b ON b.id = bf.book_id
          WHERE b.status = 'LIVE' AND bf.stock IS NOT NULL AND bf.stock <= ${LOW_STOCK}
          ORDER BY bf.stock, b.title LIMIT 10`),
      this.db.execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM users WHERE role = 'USER' AND status <> 'DELETED'`,
      ),
      this.db.execute<{
        title: string;
        author: string;
        genre: string;
        description: string;
        status: string;
        content_hash: string | null;
      }>(sql`
          SELECT b.title, b.author, b.genre, b.description, b.status, e.content_hash
          FROM books b LEFT JOIN book_embeddings e ON e.book_id = b.id
          WHERE b.status = 'LIVE'`),
      this.db.execute<{
        question: string;
        source_count: number;
        fallback: boolean;
        created_at: Date;
      }>(sql`
          SELECT question, source_count, fallback, created_at FROM ai_questions
          ORDER BY created_at DESC LIMIT 8`),
      this.db.execute<{ question: string; n: number }>(sql`
          SELECT lower(question) AS question, count(*)::int AS n FROM ai_questions
          WHERE source_count = 0 AND created_at > now() - interval '30 days'
          GROUP BY lower(question) ORDER BY n DESC LIMIT 8`),
    ]);

    const orders = Object.fromEntries(
      ORDER_STATUSES.map((s) => [s, 0]),
    ) as Record<OrderStatus, number>;
    const revenue: Prices = { KRW: 0, USD: 0 };
    for (const r of orderRows) {
      orders[r.status] += r.n;
      if (r.status === 'IN_PROCESS' || r.status === 'DELIVERED')
        revenue[r.currency] += r.revenue;
    }
    const books = Object.fromEntries(
      BOOK_STATUSES.map((s) => [s, 0]),
    ) as Record<BookStatus, number>;
    for (const r of bookRows) books[r.status] = r.n;

    const counts = { indexed: 0, stale: 0, missing: 0 };
    for (const e of embeddings) {
      const s = this.index.statusOf(e, e.content_hash);
      if (s === 'INDEXED') counts.indexed++;
      else if (s === 'STALE') counts.stale++;
      else if (s === 'MISSING') counts.missing++;
    }

    return {
      orders,
      revenue,
      books,
      lowStock: lowStock.map((r) => ({
        bookId: r.book_id,
        slug: r.slug,
        title: r.title,
        format: r.format,
        stock: r.stock,
      })),
      members: members?.n ?? 0,
      index: {
        enabled: this.index.enabled,
        ...counts,
        job: this.index.status(),
      },
      recentQuestions: recent.map((r) => ({
        question: r.question,
        sourceCount: r.source_count,
        fallback: r.fallback,
        createdAt: new Date(r.created_at).toISOString(),
      })),
      unanswered: unanswered.map((r) => ({ question: r.question, count: r.n })),
    };
  }
}
