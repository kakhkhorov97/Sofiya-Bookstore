import {
  BOOK_FORMATS,
  BOOK_STATUSES,
  GENRES,
  ORDER_STATUSES,
  USER_ROLES,
} from '@sofiya/shared';
import { sql } from 'drizzle-orm';
import {
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const genreEnum = pgEnum('genre', GENRES);
export const bookFormatEnum = pgEnum('book_format', BOOK_FORMATS);
export const bookStatusEnum = pgEnum('book_status', BOOK_STATUSES);
export const orderStatusEnum = pgEnum('order_status', ORDER_STATUSES);
export const userRoleEnum = pgEnum('user_role', USER_ROLES);
export const userStatusEnum = pgEnum('user_status', [
  'ACTIVE',
  'BLOCKED',
  'DELETED',
]);

const tsvector = customType<{ data: string }>({
  dataType: () => 'tsvector',
});

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    role: userRoleEnum('role').notNull().default('USER'),
    status: userStatusEnum('status').notNull().default('ACTIVE'),
    points: integer('points').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_lower_key').on(sql`lower(${t.email})`),
    check('users_points_nonnegative', sql`${t.points} >= 0`),
  ],
);

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    genre: genreEnum('genre').notNull(),
    description: text('description').notNull(),
    pages: integer('pages'),
    // Negative years are BC (e.g. -430 for Herodotus).
    publishedYear: integer('published_year'),
    language: text('language').notNull().default('English'),
    status: bookStatusEnum('status').notNull().default('DRAFT'),
    views: integer('views').notNull().default(0),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(author, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')`,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('books_slug_key').on(t.slug),
    index('books_genre_status_idx').on(t.genre, t.status),
    index('books_search_idx').using('gin', t.search),
    check('books_pages_positive', sql`${t.pages} IS NULL OR ${t.pages} > 0`),
  ],
);

export const bookFormats = pgTable(
  'book_formats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    format: bookFormatEnum('format').notNull(),
    priceCents: integer('price_cents').notNull(),
    // NULL = digital, never runs out.
    stock: integer('stock'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('book_formats_book_format_key').on(t.bookId, t.format),
    check('book_formats_price_nonnegative', sql`${t.priceCents} >= 0`),
    check(
      'book_formats_stock_nonnegative',
      sql`${t.stock} IS NULL OR ${t.stock} >= 0`,
    ),
  ],
);

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    status: orderStatusEnum('status').notNull().default('PAUSED'),
    subtotalCents: integer('subtotal_cents').notNull(),
    deliveryCents: integer('delivery_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    // One key per checkout form; a retried request returns the same order.
    idempotencyKey: uuid('idempotency_key').notNull(),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_user_idempotency_key').on(t.userId, t.idempotencyKey),
    index('orders_user_status_idx').on(t.userId, t.status),
    check(
      'orders_total_matches',
      sql`${t.totalCents} = ${t.subtotalCents} + ${t.deliveryCents}`,
    ),
  ],
);

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    formatId: uuid('format_id')
      .notNull()
      .references(() => bookFormats.id),
    quantity: integer('quantity').notNull(),
    // Copied from book_formats at checkout, never from the client.
    unitPriceCents: integer('unit_price_cents').notNull(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    check('order_items_quantity_positive', sql`${t.quantity} > 0`),
  ],
);
