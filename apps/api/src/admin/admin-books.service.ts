import {
  BadGatewayException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  AiDraft,
  type AdminBook,
  type AdminBookListQuery,
  type AiDraftInput,
  type BookFormat,
  type BookInputParsed,
  type BookStatus,
  type Genre,
  type Page,
} from '@sofiya/shared';
import { randomUUID } from 'node:crypto';
import { sql, SQL } from 'drizzle-orm';
import { IndexJobService } from '../ai/index-job.service';
import { AI_PROVIDER, AiProvider } from '../ai/provider';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { slugify, slugifyName } from '../db/seed/seed';
import { processCover } from '../storage/images';
import { coverUrl, FILE_STORAGE } from '../storage/storage';
import type { FileStorage } from '../storage/storage';

interface BookRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: Genre;
  description: string;
  pages: number | null;
  published_year: number | null;
  language: string;
  status: BookStatus;
  staff_pick_note: string | null;
  cover_key: string | null;
  views: number;
  updated_at: Date;
  content_hash: string | null;
  formats: {
    id: string;
    format: BookFormat;
    priceCents: number;
    stock: number | null;
  }[];
  [key: string]: unknown;
}

const BOOK_SELECT = sql`
  SELECT b.*, e.content_hash,
    coalesce((
      SELECT json_agg(json_build_object(
        'id', bf.id, 'format', bf.format, 'priceCents', bf.price_cents, 'stock', bf.stock
      ) ORDER BY bf.format)
      FROM book_formats bf WHERE bf.book_id = b.id
    ), '[]'::json) AS formats
  FROM books b LEFT JOIN book_embeddings e ON e.book_id = b.id`;

@Injectable()
export class AdminBooksService {
  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
    private readonly index: IndexJobService,
  ) {}

  private toAdmin(r: BookRow): AdminBook {
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      author: r.author,
      genre: r.genre,
      description: r.description,
      pages: r.pages,
      publishedYear: r.published_year,
      language: r.language,
      status: r.status,
      staffPickNote: r.staff_pick_note,
      coverUrl: coverUrl(r.cover_key),
      formats: r.formats,
      indexStatus: this.index.statusOf(r, r.content_hash),
      views: r.views,
      updatedAt: new Date(r.updated_at).toISOString(),
    };
  }

  // The catalogue is small (hundreds of books), so index status is computed
  // in memory and filtering by it happens before paging.
  async list(query: AdminBookListQuery): Promise<Page<AdminBook>> {
    const where: SQL[] = [sql`b.status <> 'DELETED'`];
    if (query.status) where.push(sql`b.status = ${query.status}`);
    if (query.genre) where.push(sql`b.genre = ${query.genre}`);
    if (query.q) {
      const like = `%${query.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push(
        sql`(b.title ILIKE ${like} ESCAPE '\\' OR b.author ILIKE ${like} ESCAPE '\\' OR b.slug ILIKE ${like} ESCAPE '\\')`,
      );
    }
    const rows = await this.db.execute<BookRow>(
      sql`${BOOK_SELECT} WHERE ${sql.join(where, sql` AND `)} ORDER BY b.updated_at DESC, b.title`,
    );
    let books = rows.map((r) => this.toAdmin(r));
    if (query.index) books = books.filter((b) => b.indexStatus === query.index);
    const start = (query.page - 1) * query.limit;
    return {
      items: books.slice(start, start + query.limit),
      total: books.length,
      page: query.page,
      limit: query.limit,
    };
  }

  async get(id: string): Promise<AdminBook> {
    const [row] = await this.db.execute<BookRow>(
      sql`${BOOK_SELECT} WHERE b.id = ${id} AND b.status <> 'DELETED'`,
    );
    if (!row) throw new NotFoundException('Book not found');
    return this.toAdmin(row);
  }

  private async uniqueSlug(title: string, author: string): Promise<string> {
    const base = slugify(title, author) || 'book';
    const taken = await this.db.execute<{ slug: string }>(
      sql`SELECT slug FROM books WHERE slug = ${base} OR slug LIKE ${`${base}-%`}`,
    );
    const used = new Set(taken.map((r) => r.slug));
    if (!used.has(base)) return base;
    for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  async create(input: BookInputParsed): Promise<AdminBook> {
    const slug = await this.uniqueSlug(input.title, input.author);
    const id = await this.db.transaction(async (tx) => {
      const [book] = await tx.execute<{ id: string }>(sql`
        INSERT INTO books (slug, title, author, author_slug, genre, description, pages,
                           published_year, language, status, staff_pick_note)
        VALUES (${slug}, ${input.title}, ${input.author}, ${slugifyName(input.author)},
                ${input.genre}, ${input.description}, ${input.pages}, ${input.publishedYear},
                ${input.language}, ${input.status}, ${input.staffPickNote})
        RETURNING id`);
      for (const f of input.formats) {
        await tx.execute(sql`
          INSERT INTO book_formats (book_id, format, price_cents, stock)
          VALUES (${book.id}, ${f.format}, ${f.priceCents}, ${f.stock})`);
      }
      return book.id;
    });
    this.index.trigger();
    return this.get(id);
  }

  async update(id: string, input: BookInputParsed): Promise<AdminBook> {
    await this.get(id);
    await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        UPDATE books SET title = ${input.title}, author = ${input.author},
          author_slug = ${slugifyName(input.author)}, genre = ${input.genre},
          description = ${input.description}, pages = ${input.pages},
          published_year = ${input.publishedYear}, language = ${input.language},
          status = ${input.status}, staff_pick_note = ${input.staffPickNote},
          updated_at = now()
        WHERE id = ${id}`);

      for (const f of input.formats) {
        await tx.execute(sql`
          INSERT INTO book_formats (book_id, format, price_cents, stock)
          VALUES (${id}, ${f.format}, ${f.priceCents}, ${f.stock})
          ON CONFLICT (book_id, format) DO UPDATE
          SET price_cents = EXCLUDED.price_cents, stock = EXCLUDED.stock, updated_at = now()`);
      }

      const keep = input.formats.map((f) => sql`${f.format}`);
      const removed = await tx.execute<{ id: string; format: BookFormat }>(sql`
        SELECT id, format FROM book_formats
        WHERE book_id = ${id} AND format NOT IN (${sql.join(keep, sql`, `)})`);
      for (const f of removed) {
        const [ordered] = await tx.execute(
          sql`SELECT 1 FROM order_items WHERE format_id = ${f.id} LIMIT 1`,
        );
        if (ordered) {
          throw new ConflictException(
            `The ${f.format.toLowerCase()} edition has been ordered before, so it can't be removed. Set its stock to 0 instead.`,
          );
        }
        await tx.execute(sql`DELETE FROM book_formats WHERE id = ${f.id}`);
      }
    });
    this.index.trigger();
    return this.get(id);
  }

  // Soft delete: orders keep their history, the shop stops showing the book.
  async remove(id: string): Promise<void> {
    await this.get(id);
    await this.db.execute(
      sql`UPDATE books SET status = 'DELETED', updated_at = now() WHERE id = ${id}`,
    );
    await this.db.execute(sql`DELETE FROM wishlist WHERE book_id = ${id}`);
    this.index.trigger();
  }

  async setCover(id: string, upload: Buffer): Promise<AdminBook> {
    await this.get(id);
    const image = await processCover(upload);
    const key = `covers/${randomUUID()}.webp`;
    await this.storage.put(key, image.data, image.contentType);
    const [old] = await this.db.execute<{ cover_key: string | null }>(sql`
      UPDATE books b SET cover_key = ${key}, updated_at = now()
      FROM (SELECT cover_key FROM books WHERE id = ${id}) prev
      WHERE b.id = ${id}
      RETURNING prev.cover_key`);
    if (old?.cover_key) await this.storage.delete(old.cover_key);
    return this.get(id);
  }

  async removeCover(id: string): Promise<AdminBook> {
    await this.get(id);
    const [old] = await this.db.execute<{ cover_key: string | null }>(sql`
      UPDATE books b SET cover_key = NULL, updated_at = now()
      FROM (SELECT cover_key FROM books WHERE id = ${id}) prev
      WHERE b.id = ${id}
      RETURNING prev.cover_key`);
    if (old?.cover_key) await this.storage.delete(old.cover_key);
    return this.get(id);
  }

  // The admin reviews and edits the draft before anything is saved.
  async draft(input: AiDraftInput, cover?: Buffer): Promise<AiDraft> {
    if (!this.provider) {
      throw new ServiceUnavailableException('AI drafts need GEMINI_API_KEY.');
    }
    const image = cover ? (await processCover(cover)).data : undefined;
    let raw: unknown;
    try {
      raw = await this.provider.draftBook({ ...input, cover: image });
    } catch {
      throw new BadGatewayException(
        'The AI could not write a draft right now. Please try again.',
      );
    }
    const parsed = AiDraft.safeParse(raw);
    if (!parsed.success) {
      throw new BadGatewayException(
        'The AI draft was not usable. Please try again.',
      );
    }
    return parsed.data;
  }
}
