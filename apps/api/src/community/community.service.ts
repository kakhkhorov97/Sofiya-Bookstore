import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  BookSummary,
  NewsletterInput,
  ReviewInput,
  ReviewsResponse,
  ReviewView,
} from '@sofiya/shared';
import { sql } from 'drizzle-orm';
import { summariesByIds } from '../books/summary';
import { pgErrorCode, UNIQUE_VIOLATION } from '../common/pg-error';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';

const REVIEWS_SHOWN = 30;

interface ReviewRow {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string;
  display_name: string;
  created_at: Date;
  updated_at: Date;
  [key: string]: unknown;
}

const toReview = (r: ReviewRow): ReviewView => ({
  id: r.id,
  rating: r.rating,
  title: r.title,
  body: r.body,
  reviewerName: r.display_name,
  createdAt: new Date(r.created_at).toISOString(),
  updatedAt: new Date(r.updated_at).toISOString(),
});

@Injectable()
export class CommunityService {
  constructor(@InjectDb() private readonly db: Db) {}

  private async liveBookId(slug: string): Promise<string> {
    const [row] = await this.db.execute<{ id: string }>(
      sql`SELECT id FROM books WHERE slug = ${slug} AND status = 'LIVE'`,
    );
    if (!row) throw new NotFoundException('Book not found');
    return row.id;
  }

  // ---- Wishlist ----------------------------------------------------------

  async wishlist(userId: string): Promise<BookSummary[]> {
    const rows = await this.db.execute<{ book_id: string }>(sql`
      SELECT book_id FROM wishlist WHERE user_id = ${userId} ORDER BY created_at DESC`);
    return summariesByIds(
      this.db,
      rows.map((r) => r.book_id),
    );
  }

  async wishlistIds(userId: string): Promise<string[]> {
    const rows = await this.db.execute<{ book_id: string }>(
      sql`SELECT book_id FROM wishlist WHERE user_id = ${userId}`,
    );
    return rows.map((r) => r.book_id);
  }

  async addToWishlist(userId: string, bookId: string): Promise<void> {
    const inserted = await this.db.execute(sql`
      INSERT INTO wishlist (user_id, book_id)
      SELECT ${userId}, id FROM books WHERE id = ${bookId} AND status = 'LIVE'
      ON CONFLICT DO NOTHING
      RETURNING book_id`);
    if (inserted.length === 0) {
      const [exists] = await this.db.execute(
        sql`SELECT 1 FROM books WHERE id = ${bookId} AND status = 'LIVE'`,
      );
      if (!exists) throw new NotFoundException('Book not found');
    }
  }

  async removeFromWishlist(userId: string, bookId: string): Promise<void> {
    await this.db.execute(
      sql`DELETE FROM wishlist WHERE user_id = ${userId} AND book_id = ${bookId}`,
    );
  }

  // ---- Reviews -----------------------------------------------------------

  // Only readers whose order for the book was confirmed may review it.
  private async hasBought(userId: string, bookId: string): Promise<boolean> {
    const [row] = await this.db.execute(sql`
      SELECT 1 FROM orders o
      JOIN order_items oi ON oi.order_id = o.id
      JOIN book_formats bf ON bf.id = oi.format_id
      WHERE o.user_id = ${userId} AND bf.book_id = ${bookId}
        AND o.status IN ('IN_PROCESS', 'DELIVERED')
      LIMIT 1`);
    return !!row;
  }

  async reviews(
    slug: string,
    viewerId: string | null,
  ): Promise<ReviewsResponse> {
    const bookId = await this.liveBookId(slug);
    const [rows, stats] = await Promise.all([
      this.db.execute<ReviewRow>(sql`
        SELECT r.*, u.display_name FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.book_id = ${bookId} AND u.status = 'ACTIVE'
        ORDER BY r.created_at DESC LIMIT ${REVIEWS_SHOWN}`),
      this.db.execute<{ rating: number; n: number }>(sql`
        SELECT r.rating, count(*)::int AS n FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.book_id = ${bookId} AND u.status = 'ACTIVE' GROUP BY r.rating`),
    ]);

    const distribution: [number, number, number, number, number] = [
      0, 0, 0, 0, 0,
    ];
    for (const s of stats) distribution[s.rating - 1] = s.n;
    const count = distribution.reduce((a, b) => a + b, 0);
    const average = count
      ? Math.round(
          (distribution.reduce((sum, n, i) => sum + n * (i + 1), 0) / count) *
            10,
        ) / 10
      : null;

    const mine = viewerId
      ? rows.find((r) => r.user_id === viewerId)
      : undefined;
    let myReview = mine ? toReview(mine) : null;
    if (viewerId && !myReview) {
      const [own] = await this.db.execute<ReviewRow>(sql`
        SELECT r.*, u.display_name FROM reviews r JOIN users u ON u.id = r.user_id
        WHERE r.book_id = ${bookId} AND r.user_id = ${viewerId}`);
      myReview = own ? toReview(own) : null;
    }
    const bought = viewerId ? await this.hasBought(viewerId, bookId) : false;

    return {
      summary: { average, count, distribution },
      items: rows.map(toReview),
      viewer: {
        canReview: bought,
        reason: !viewerId ? 'SIGN_IN' : bought ? null : 'NOT_PURCHASED',
        myReview,
      },
    };
  }

  async saveReview(
    userId: string,
    slug: string,
    input: ReviewInput,
  ): Promise<ReviewView> {
    const bookId = await this.liveBookId(slug);
    if (!(await this.hasBought(userId, bookId))) {
      throw new ForbiddenException(
        'You can review a book once your order for it has been confirmed.',
      );
    }
    const [row] = await this.db.execute<ReviewRow>(sql`
      WITH saved AS (
        INSERT INTO reviews (user_id, book_id, rating, title, body)
        VALUES (${userId}, ${bookId}, ${input.rating}, ${input.title ?? null}, ${input.body})
        ON CONFLICT (user_id, book_id) DO UPDATE
        SET rating = EXCLUDED.rating, title = EXCLUDED.title, body = EXCLUDED.body, updated_at = now()
        RETURNING *
      )
      SELECT saved.*, u.display_name FROM saved JOIN users u ON u.id = saved.user_id`);
    return toReview(row);
  }

  async deleteReview(userId: string, slug: string): Promise<void> {
    const bookId = await this.liveBookId(slug);
    await this.db.execute(
      sql`DELETE FROM reviews WHERE user_id = ${userId} AND book_id = ${bookId}`,
    );
  }

  // ---- Newsletter --------------------------------------------------------

  // Returns false when the address was already subscribed.
  async subscribe(input: NewsletterInput): Promise<boolean> {
    try {
      await this.db.execute(
        sql`INSERT INTO newsletter_subscribers (email) VALUES (${input.email})`,
      );
      return true;
    } catch (err) {
      if (pgErrorCode(err) === UNIQUE_VIOLATION) return false;
      throw err;
    }
  }
}
