import {
  BOOK_FORMATS,
  BOOK_STATUSES,
  GENRES,
  ORDER_STATUSES,
  USER_ROLES,
} from '@sofiya/shared';
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  customType,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
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
    // Sessions issued before this moment are rejected (set when the password
    // is reset, so a stolen session stops working). Whole seconds, like JWT iat.
    sessionsValidAfter: timestamp('sessions_valid_after', {
      withTimezone: true,
    }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('users_email_lower_key').on(sql`lower(${t.email})`),
    check('users_points_nonnegative', sql`${t.points} >= 0`),
  ],
);

// One-time password reset links. Only a SHA-256 hash of the token is kept,
// so a database leak cannot be used to reset passwords.
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_hash').on(t.tokenHash),
    index('password_reset_tokens_user_idx').on(t.userId),
  ],
);

export const books = pgTable(
  'books',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    author: text('author').notNull(),
    // URL name of the author page, e.g. "jane-austen".
    authorSlug: text('author_slug').notNull().default(''),
    genre: genreEnum('genre').notNull(),
    description: text('description').notNull(),
    pages: integer('pages'),
    // Negative years are BC (e.g. -430 for Herodotus).
    publishedYear: integer('published_year'),
    language: text('language').notNull().default('English'),
    status: bookStatusEnum('status').notNull().default('DRAFT'),
    views: integer('views').notNull().default(0),
    // A short note shown in the homepage "Staff picks" row; NULL = not a pick.
    staffPickNote: text('staff_pick_note'),
    // Storage key of the uploaded cover (e.g. "covers/3f…a1.webp"); NULL = typographic cover.
    coverKey: text('cover_key'),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(author, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(description, '')), 'B')`,
    ),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('books_slug_key').on(t.slug),
    index('books_genre_status_idx').on(t.genre, t.status),
    index('books_search_idx').using('gin', t.search),
    index('books_author_slug_idx').on(t.authorSlug),
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
    // Two store-set prices: US cents and Korean won (no live conversion).
    priceCents: integer('price_cents').notNull(),
    priceKrw: integer('price_krw').notNull(),
    // NULL = digital, never runs out.
    stock: integer('stock'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('book_formats_book_format_key').on(t.bookId, t.format),
    check('book_formats_price_nonnegative', sql`${t.priceCents} >= 0`),
    check('book_formats_price_krw_nonnegative', sql`${t.priceKrw} >= 0`),
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
    // Amounts below are in this currency's smallest unit (won or cents),
    // whatever the column names say.
    currency: text('currency').notNull().default('USD'),
    subtotalCents: integer('subtotal_cents').notNull(),
    deliveryCents: integer('delivery_cents').notNull(),
    totalCents: integer('total_cents').notNull(),
    // One key per checkout form; a retried request returns the same order.
    idempotencyKey: uuid('idempotency_key').notNull(),
    // Hash of the order lines sent with that key: same key + different
    // lines is a client bug and gets a 409 instead of a silent reuse.
    requestHash: text('request_hash').notNull(),
    pointsAwarded: integer('points_awarded').notNull().default(0),
    // CARD = Toss Payments (paid before the order is confirmed);
    // BANK_TRANSFER = the admin confirms once the money has arrived.
    paymentMethod: text('payment_method').notNull().default('BANK_TRANSFER'),
    // UNPAID -> CONFIRMING (while Toss approves) -> PAID -> REFUNDED.
    paymentStatus: text('payment_status').notNull().default('UNPAID'),
    // Toss's id for the payment; needed for refunds. Unique, so one Toss
    // payment can never pay for two orders.
    paymentKey: text('payment_key'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    receiptUrl: text('receipt_url'),
    // Toss's message from the last failed attempt, shown to the customer.
    paymentError: text('payment_error'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_user_idempotency_key').on(t.userId, t.idempotencyKey),
    uniqueIndex('orders_payment_key').on(t.paymentKey),
    check(
      'orders_payment_method_known',
      sql`${t.paymentMethod} IN ('CARD', 'BANK_TRANSFER')`,
    ),
    check(
      'orders_payment_status_known',
      sql`${t.paymentStatus} IN ('UNPAID', 'CONFIRMING', 'PAID', 'REFUNDED')`,
    ),
    index('orders_user_status_idx').on(t.userId, t.status),
    check('orders_currency_known', sql`${t.currency} IN ('USD', 'KRW')`),
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

export const wishlist = pgTable(
  'wishlist',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bookId] })],
);

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    bookId: uuid('book_id')
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    rating: smallint('rating').notNull(),
    title: text('title'),
    body: text('body').notNull(),
    ...timestamps,
  },
  (t) => [
    // One review per reader per book; editing replaces it.
    uniqueIndex('reviews_user_book_key').on(t.userId, t.bookId),
    index('reviews_book_idx').on(t.bookId, t.createdAt),
    check('reviews_rating_range', sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

export const newsletterSubscribers = pgTable(
  'newsletter_subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex('newsletter_email_lower_key').on(sql`lower(${t.email})`)],
);

// One embedding per book (title, author, genre and description), used by
// Ask Sofiya, meaning-based search and "If you like this".
export const EMBEDDING_DIMENSIONS = 768;

export const bookEmbeddings = pgTable(
  'book_embeddings',
  {
    bookId: uuid('book_id')
      .primaryKey()
      .references(() => books.id, { onDelete: 'cascade' }),
    embedding: vector('embedding', {
      dimensions: EMBEDDING_DIMENSIONS,
    }).notNull(),
    // Hash of the text that was embedded; a changed book gets re-embedded.
    contentHash: text('content_hash').notNull(),
    model: text('model').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('book_embeddings_hnsw_idx').using(
      'hnsw',
      t.embedding.op('vector_cosine_ops'),
    ),
  ],
);

// What readers ask Sofiya, without who asked: powers the admin's
// "What readers asked" list and shows demand the catalogue cannot meet.
export const aiQuestions = pgTable(
  'ai_questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    question: text('question').notNull(),
    sourceCount: integer('source_count').notNull(),
    fallback: boolean('fallback').notNull().default(false),
    latencyMs: integer('latency_ms').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('ai_questions_created_idx').on(t.createdAt)],
);
