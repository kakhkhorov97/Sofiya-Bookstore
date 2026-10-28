# Sofiya AI

An online bookstore where readers describe the book they want and get answers that cite books the store actually stocks. This rebuilds the earlier Sofiya-react + Sofiya-Bookstore project. See [docs/PLAN.md](docs/PLAN.md) for the full plan and [docs/design-concepts](docs/design-concepts) for the designs. The original Express + EJS code is kept on the `develop` branch.

## Layout

| Path | What |
|---|---|
| `apps/web` | Next.js 15 App Router storefront and admin (Tailwind v4) |
| `apps/api` | NestJS 11 REST API, served under `/api` |
| `packages/shared` | Domain enums, Zod schemas and pricing rules used by both |
| `docs/gcp-setup.md` | One-time Google Cloud and GitHub setup |
| `.github/workflows` | CI on every push; manual Cloud Run deploy |

## Run locally

Requires Node 20+ and npm 10+ (npm workspaces).

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
createdb sofiya_dev && createdb sofiya_test   # local PostgreSQL 15+
npm run db:migrate
npm run db:seed                               # 172 demo books
npm run db:create-admin -w @sofiya/api -- you@example.com "a long password" "Your Name"
npm run dev         # web on :3000, api on :8080
```

Health checks: `http://localhost:8080/api/health` and `http://localhost:3000/api/health`.

## Admin panel

Sign in with an admin account (create one with `npm run db:create-admin -w @sofiya/api -- email "password" "Name"`) and open http://localhost:3000/admin. Everyone else gets a 404.

- **Overview**: orders waiting for confirmation, confirmed revenue, low stock, AI index health, and what readers asked Sofiya.
- **Books**: search and filter (status, AI index), create and edit books with formats, prices and stock, soft delete. A format that was ordered cannot be removed (set its stock to 0).
- **Covers**: JPEG, PNG or WebP up to 5 MB. Every upload is decoded and re-encoded to WebP with sharp (non-images are rejected, EXIF/GPS is stripped) and stored under `apps/api/uploads/` (`UPLOADS_DIR`). Cloud Storage replaces local disk on Cloud Run.
- **Draft with AI**: Gemini writes a description and suggests genre, pages and year from the title, author, an optional cover photo and notes (structured JSON output). It fills the form; nothing is saved until the admin reviews and saves. Unknown books get no invented page count or year.
- **Orders**: filter and search by customer; confirm, mark delivered or cancel (only the moves the API allows).
- **Members**: search, block and unblock (never yourself or another admin); blocking signs the member out at once.
- **AI & search**: index status, background re-indexing (saving a book re-indexes it automatically), and questions the catalogue could not answer. Questions are stored without names.

## Website pages

`/` home · `/books` browse, search and filter · `/books/:slug` book page · `/basket` · `/checkout` · `/orders`, `/orders/:id` · `/account` · `/signin`, `/signup`.

The basket lives in the browser (localStorage) and is re-priced from the API on every view; checkout sends one idempotency key per basket so a double click cannot create two orders.

### Currencies

Prices are in **Korean won (₩, the default)** or **US dollars ($)**. Readers pick one with the ₩ KRW / $ USD switch in the header (or the mobile menu); the choice is kept in the `sofiya_currency` cookie so server pages render in it straight away.

- Every format has its own won price and dollar price, set by the store (no live exchange rate). The admin editor has a "₩ from $" button that suggests a round won price (`suggestKrw`, about ₩1,400 per $1).
- Money is always an integer in the smallest unit: won for KRW, cents for USD.
- Delivery: ₩3,000, free from ₩30,000; or $5, free from $100.
- An order is charged and stored in the currency it was placed in, and always shown in that currency. Admin revenue and member spend are totalled per currency.

### Payments

Two ways to pay, chosen at checkout:

- **Card or easy pay (Toss Payments).** The order is created unpaid (stock is held), the Toss window opens, and Toss sends the browser to `/checkout/success`. The API then confirms the payment with Toss for the total it stored (never an amount from the browser), marks the order paid and confirms it at once. A declined card leaves the order unpaid with a **Pay now** button; unpaid card orders are cancelled after `CARD_PAYMENT_TIMEOUT_MINUTES` (30) and their stock returned. Cancelling a paid card order in the admin refunds it through Toss first.
- **Bank transfer.** The order page shows the store's account (`BANK_*` settings); the admin confirms the order when the money arrives, which marks it paid.

Cards are only offered in `CARD_CURRENCIES` (won by default: Toss needs a separate contract per currency). Settings: `TOSS_CLIENT_KEY` and `TOSS_SECRET_KEY` (test keys for test mode, no real money), or `PAYMENTS_PROVIDER=fake` to try the card flow locally with no Toss account (the window is skipped). Sofiya never sees card details: they are entered in Toss's window.

## AI: Ask Sofiya (RAG with Gemini)

1. Get a key at https://aistudio.google.com and add it to `apps/api/.env`: `GEMINI_API_KEY=...`
2. Embed the catalogue (re-run after adding or editing books; unchanged books are skipped). On Gemini's free tier (~100 embeddings a minute) the script waits and retries automatically:

   ```bash
   npm run ai:index -w @sofiya/api
   ```
3. Start the site with `npm run dev` and open http://localhost:3000/ask.

How it works: each book's title, author, genre and description is embedded (`gemini-embedding-001`, 768 dimensions) into `book_embeddings` (pgvector, HNSW index). A question is matched by meaning and by keywords (Postgres full text on the question's meaningful words, plus partial title/author), and the two rankings are fused with Reciprocal Rank Fusion (a keyword hit only in a description counts half; hits on the title or author count fully). Meaning matches count only when the best book reaches `AI_MIN_SIMILARITY` (0.60) and the others are within `AI_SIMILARITY_WINDOW` (0.06) of it; on this catalogue real matches score 0.62–0.72 and off-topic or nonsense questions stay below 0.60. The top 5 books are sent to Gemini with a prompt that allows recommending only those numbered books; the server keeps only citations that point at them. No candidates means no model call. Answers come from `GEMINI_CHAT_MODEL` (`gemini-3.5-flash-lite`, about 1–2 s); if it fails or sends nothing within 10 s, `GEMINI_FALLBACK_MODEL` (`gemini-3.6-flash`) is tried once. If both fail, the matching books are still shown. Model names are settings because Google retires models for new keys (as happened to `gemini-2.5-flash`). Limits: `AI_RATE_LIMIT` questions per minute per visitor and `AI_DAILY_CAP` per day (shared by every instance when `REDIS_URL` is set).

### Measuring retrieval quality

```bash
npm run ai:eval -w @sofiya/api
```

runs 45 fixed questions (`apps/api/src/ai/eval/questions.ts`: direct, paraphrased, themed, and unanswerable) through hybrid, keyword-only and meaning-only retrieval and writes [`docs/rag-eval.md`](docs/rag-eval.md) with hit@1, hit@5, MRR and the share of unanswerable questions that correctly return nothing. Latest run: hybrid finds a correct book in the top five for every question (hit@5 100%, hit@1 93%, MRR 0.95) against keyword-only hit@5 85%, and returns nothing for all unanswerable questions. Re-run it after changing retrieval, prompts' sources or the catalogue.

Without a key the site works normally: search is keyword-only, "If you like this" uses the same genre, and the Ask page says it is not switched on. Tests use an offline fake provider (`AI_PROVIDER=fake`), so they need no key.

## Accounts: email confirmation and Google

- **Sign up with email**: the account works at once for browsing, and a "Confirm your email" link (24 hours, one use, only a hash stored) is emailed. Ordering and writing reviews wait until the address is confirmed (`403` with `code: "EMAIL_NOT_VERIFIED"`); a banner offers **Resend email** (at most one a minute). Without an email service (`EMAIL_PROVIDER=off`) addresses are accepted as they are, since nobody could confirm them. Accounts created before confirmation existed count as confirmed, and so do admins created with `db:create-admin`.
- **Continue with Google** (when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set): `GET /api/auth/google` sends the browser to Google with a random `state` and a PKCE challenge, remembered in a signed 10-minute cookie; the callback checks both, exchanges the code on the server and verifies Google's ID token (`google-auth-library`). Only emails Google has verified are accepted. The Google account is matched by its id, then by email (linking it to an existing account), or a new confirmed account is created. Linking to an account whose email was never confirmed also cancels that account's password and sessions, so whoever registered the address first cannot keep access. A forged or expired callback, a cancelled sign-in, an unverified Google email or a blocked account sends the browser back to the sign-in page with an explanation.

## Emails

- **Forgot password**: `/forgot-password` emails a one-time link (`/reset-password?token=…`) valid for `PASSWORD_RESET_MINUTES` (30). The answer is the same whether or not the email has an account, at most one email a minute is sent per account, and only a SHA-256 hash of the token is stored. Resetting signs out every existing session (`users.sessions_valid_after` is checked against each session's issue time).
- **Order emails**: when a bank-transfer order is placed (with the account details), when an order is paid or confirmed, delivered, and cancelled (saying whether a card payment was refunded). They are sent in the background, so email problems never affect the order.
- `EMAIL_PROVIDER`: `log` (default locally: emails are printed in the API terminal, so reset links can be clicked from there), `resend` (with `RESEND_API_KEY` and `EMAIL_FROM` on a verified domain), or `off` (default in production). Production refuses `log`, so reset links never end up in server logs.

## Shared limits (Redis)

Set `REDIS_URL` (`redis://…`, or `rediss://…` for Upstash) to keep rate limits and the daily AI cap in Redis, shared by every API instance. Without it each instance counts in memory, which is fine for one instance. If Redis becomes unreachable the API falls back to memory instead of failing. `REDIS_TEST_URL=redis://127.0.0.1:6390 npx jest src/redis` runs the Redis tests against a real server.

## Database

PostgreSQL via Drizzle ORM. Schema: `apps/api/src/db/schema.ts`; SQL migrations: `apps/api/drizzle/`.

- Change the schema, then `npm run db:generate -w @sofiya/api` to write a new migration.
- API tests run against `sofiya_test` (override with `DATABASE_URL_TEST`; the name must end in `_test`).
- The demo catalogue (`apps/api/src/db/seed/catalogue.ts`) is real public-domain books plus freely licensed programming books, with original descriptions. Prices and stock are demo values.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/books` | `q`, `genre`, `format`, `inStock`, `sort` (relevance, newest, title, price_asc, price_desc, popular), `currency` (KRW default, USD; used for price sorting), `page`, `limit` (max 60) |
| GET | `/api/books/:slug` | Details with formats, prices (`{ KRW, USD }`) and stock flags |
| GET | `/api/genres` | Live book count per genre |
| GET | `/api/formats?ids=a,b` | Current price, stock and availability for basket lines |
| GET | `/api/books/:slug/similar` | "If you like this": nearest books by meaning (same-genre fallback) |
| GET | `/api/authors/:slug` | Author page with all live books |
| GET / PUT / DELETE | `/api/books/:slug/reviews` | Reviews; writing needs a confirmed order for the book |
| GET | `/api/wishlist`, `/api/wishlist/ids` | Signed-in reader's saved books |
| PUT / DELETE | `/api/wishlist/:bookId` | Save or remove a book |
| POST | `/api/newsletter` | `{ email }`; 201 new, 200 already subscribed |
| GET | `/api/ai/status` | Whether AI is on and how many books are indexed |
| POST | `/api/ask` | Ask Sofiya (`message`, `history`, `filters`, `currency`; `filters.maxPrice` is in that currency); server-sent events: `sources`, `delta`…, `done` |
| GET | `/api/covers/:file` | Uploaded cover images (WebP, cached for a year) |
| GET | `/api/admin/overview` | Admin dashboard data |
| GET / POST | `/api/admin/books` | List (search, status, index filters) / create |
| GET / PUT / DELETE | `/api/admin/books/:id` | Read / replace / soft delete |
| PUT / DELETE | `/api/admin/books/:id/cover` | Upload (multipart `cover`) / remove cover |
| POST | `/api/admin/books/ai-draft` | Multipart `title`, `author`, `notes`, optional `cover` → draft |
| GET / POST | `/api/admin/ai/index` | Index job status / start re-indexing |
| GET | `/api/admin/orders/detailed` | Orders with customer, search by email or name |
| GET | `/api/admin/members` | Members with order counts and spend |
| PATCH | `/api/admin/members/:id/status` | `{ status: ACTIVE \| BLOCKED }` |
| POST | `/api/auth/signup` | `{ email, password, displayName }`; sets the session cookie |
| POST | `/api/auth/signin` | `{ email, password }`; rate limited per IP |
| POST | `/api/auth/signout` | Clears the session cookie |
| GET | `/api/auth/providers` | `{ google }`: which sign-in options are on |
| GET | `/api/auth/google`, `/api/auth/google/callback` | Continue with Google (browser redirects, not fetch calls) |
| POST | `/api/auth/email/confirm` | `{ token }` from the confirmation email; no session needed |
| POST | `/api/auth/email/resend` | Signed in: emails a new confirmation link (at most one a minute) |
| POST | `/api/auth/password/forgot` | `{ email }`; always 202. Emails a reset link if the account exists (rate limited) |
| POST | `/api/auth/password/reset` | `{ token, password }`; sets the password, uses up the link and ends all sessions |
| GET / PATCH | `/api/me` | Profile; only `displayName` can be changed |
| POST | `/api/orders` | `{ idempotencyKey, currency, paymentMethod, lines: [{ formatId, quantity }] }`; `currency` is KRW (default) or USD, `paymentMethod` is BANK_TRANSFER (default) or CARD. Prices come from the database. 201 new, 200 replay |
| POST | `/api/orders/:id/payments/toss/confirm` | `{ paymentKey, amount }` from the Toss success redirect. Confirms with Toss for the stored total; a repeat with the same key returns the paid order |
| GET | `/api/payments/config` | Public: card availability, Toss client key, card currencies, bank-transfer details |
| GET | `/api/orders`, `/api/orders/:id` | Your own orders only |
| POST | `/api/orders/:id/cancel` | Only while the order is `PAUSED` and unpaid; stock is put back |
| GET | `/api/admin/orders` | Admin only |
| PATCH | `/api/admin/orders/:id/status` | Admin only. `{ expectedStatus, status }`; PAUSED → IN_PROCESS → DELIVERED, or CANCELLED. Points are awarded once. Unpaid card orders cannot be confirmed; cancelling a paid card order refunds it |

Sessions are a signed JWT in an `httpOnly`, `SameSite=Lax` cookie holding only the user id; role and status are re-read from the database on every request. Requests that change data are refused from origins outside `WEB_ORIGINS`. The web app forwards `/api/*` to the API so the cookie stays first-party.

## Checks

```bash
npm run check       # typecheck, lint, tests, build
```

## Security headers

Every page sends `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, a strict `Referrer-Policy`, a `Permissions-Policy`, and a Content-Security-Policy limited to `frame-ancestors 'none'; object-src 'none'; base-uri 'self'` (plus HSTS and `upgrade-insecure-requests` in production). The API sends `default-src 'none'` and no `X-Powered-By`. A full script/frame CSP is a later step: Toss loads its payment window and card-company pages from many domains, and an incomplete list would break checkout.

Payments: with Toss **test** keys (`test_ck_…`), checkout shows "Test mode, no real money" and the footer says so; both disappear automatically with live keys (`live_ck_…`).

## Deploy

Both apps ship as containers to Google Cloud Run (`apps/*/Dockerfile`, built from the repo root). Do the one-time setup in `docs/gcp-setup.md`, then run the **Deploy to Cloud Run** workflow from GitHub Actions.

How production differs from local development:

- **Covers** go to a private Cloud Storage bucket (`STORAGE_DRIVER=gcs`, `GCS_BUCKET`), because Cloud Run's disk is temporary. The API still serves them at `/api/covers/…`.
- **Secrets** (`DATABASE_URL`, `AUTH_SECRET`, `PROXY_SECRET`, `GEMINI_API_KEY`) come from Secret Manager. The API refuses to start in production if one is missing or covers would be stored on local disk.
- **Migrations** run as a Cloud Run job (`node dist/db/migrate.js`) before each new API version takes traffic. The demo catalogue is loaded only when you tick that option.
- **API address**: the web image is built with `--build-arg API_URL=…`, because Next.js fixes `/api` forwarding at build time.
- **Visitor IPs**: every browser request reaches the API through the website, so the website's middleware names the visitor's IP (from `X-Forwarded-For`, counted `CLIENT_IP_HOPS` from the right) and signs it with `PROXY_SECRET`. The API only believes that header with the right secret, so rate limits apply per visitor.
