import type { BookFormat, BookStatus } from '@sofiya/shared';
import { and, eq, notInArray, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { createDb } from '../client';
import { bookFormats, books } from '../schema';
import { CATALOGUE, CatalogueEntry, STAFF_PICKS } from './catalogue';

export function slugifyName(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/['’.]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function slugify(title: string, author: string): string {
  const lastName =
    author
      .split(/ and |,/)[0]
      .trim()
      .split(' ')
      .pop() ?? '';
  return `${title} ${lastName}`
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// FNV-1a: stable pseudo-random numbers so every seed run gives the same data.
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const price = (dollars: number) => dollars * 100 + 99;

export interface SeedFormat {
  format: BookFormat;
  priceCents: number;
  stock: number | null;
}

export function formatsFor(entry: CatalogueEntry, slug: string): SeedFormat[] {
  const h = hash(slug);
  const physicalStock = (format: BookFormat) => {
    const s = hash(`${slug}:${format}`);
    return s % 13 === 0 ? 0 : (s % 60) + 1;
  };
  const out: SeedFormat[] = [];

  if (entry.genre === 'PROGRAMMING') {
    const paper = 29 + Math.floor(entry.pages / 100) + (h % 6);
    out.push({
      format: 'PAPERBACK',
      priceCents: price(paper),
      stock: physicalStock('PAPERBACK'),
    });
    if (entry.pages > 600) {
      out.push({
        format: 'HARDCOVER',
        priceCents: price(paper + 15),
        stock: physicalStock('HARDCOVER'),
      });
    }
    out.push({ format: 'EBOOK', priceCents: price(paper - 10), stock: null });
    return out;
  }

  const paper = 6 + Math.floor(entry.pages / 120) + (h % 3);
  out.push({
    format: 'PAPERBACK',
    priceCents: price(paper),
    stock: physicalStock('PAPERBACK'),
  });
  if (h % 3 !== 0 || entry.pages > 400) {
    out.push({
      format: 'HARDCOVER',
      priceCents: price(paper + 10 + (h % 5)),
      stock: physicalStock('HARDCOVER'),
    });
  }
  out.push({ format: 'EBOOK', priceCents: price(2 + (h % 3)), stock: null });
  if (h % 4 === 0) {
    out.push({
      format: 'AUDIOBOOK',
      priceCents: price(9 + (h % 6)),
      stock: null,
    });
  }
  return out;
}

export function statusFor(slug: string): BookStatus {
  return hash(slug) % 41 === 0 ? 'PAUSED' : 'LIVE';
}

export async function seedCatalogue(
  db: Db,
): Promise<{ books: number; formats: number }> {
  let formatCount = 0;
  await db.transaction(async (tx) => {
    for (const entry of CATALOGUE) {
      const slug = slugify(entry.title, entry.author);
      const values = {
        slug,
        title: entry.title,
        author: entry.author,
        authorSlug: slugifyName(entry.author),
        genre: entry.genre,
        description: entry.description,
        pages: entry.pages,
        publishedYear: entry.year,
        status: statusFor(slug),
        views: hash(`${slug}:views`) % 2000,
        staffPickNote: STAFF_PICKS[entry.title] ?? null,
      };
      const [book] = await tx
        .insert(books)
        .values(values)
        .onConflictDoUpdate({
          target: books.slug,
          set: { ...values, updatedAt: sql`now()` },
        })
        .returning({ id: books.id });

      const formats = formatsFor(entry, slug);
      formatCount += formats.length;
      for (const f of formats) {
        await tx
          .insert(bookFormats)
          .values({ bookId: book.id, ...f })
          .onConflictDoUpdate({
            target: [bookFormats.bookId, bookFormats.format],
            set: {
              priceCents: f.priceCents,
              stock: f.stock,
              updatedAt: sql`now()`,
            },
          });
      }
      await tx.delete(bookFormats).where(
        and(
          eq(bookFormats.bookId, book.id),
          notInArray(
            bookFormats.format,
            formats.map((f) => f.format),
          ),
        ),
      );
    }
  });
  return { books: CATALOGUE.length, formats: formatCount };
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to seed');
  const { db, close } = createDb(url, { max: 1 });
  seedCatalogue(db)
    .then((r) =>
      console.log(`Seeded ${r.books} books with ${r.formats} formats`),
    )
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => void close());
}
