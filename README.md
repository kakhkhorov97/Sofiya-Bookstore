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

## AI: Ask Sofiya (RAG with Gemini)

1. Get a key at https://aistudio.google.com and add it to `apps/api/.env`: `GEMINI_API_KEY=...`
2. Embed the catalogue (re-run after adding or editing books; unchanged books are skipped). On Gemini's free tier (~100 embeddings a minute) the script waits and retries automatically:

   ```bash
   npm run ai:index -w @sofiya/api
   ```
3. Start the site with `npm run dev` and open http://localhost:3000/ask.

How it works: each book's title, author, genre and description is embedded (`gemini-embedding-001`, 768 dimensions) into `book_embeddings` (pgvector, HNSW index). A question is matched by meaning and by keywords (Postgres full text on the question's meaningful words, plus partial title/author), and the two rankings are fused with Reciprocal Rank Fusion. Meaning matches count only when the best book reaches `AI_MIN_SIMILARITY` (0.60) and the others are within `AI_SIMILARITY_WINDOW` (0.06) of it; on this catalogue real matches score 0.62–0.72 and off-topic or nonsense questions stay below 0.60. The top 5 books are sent to Gemini with a prompt that allows recommending only those numbered books; the server keeps only citations that point at them. No candidates means no model call. Answers come from `GEMINI_CHAT_MODEL` (`gemini-3.5-flash-lite`, about 1–2 s); if it fails or sends nothing within 10 s, `GEMINI_FALLBACK_MODEL` (`gemini-3.6-flash`) is tried once. If both fail, the matching books are still shown. Model names are settings because Google retires models for new keys (as happened to `gemini-2.5-flash`). Limits: `AI_RATE_LIMIT` questions per minute per visitor and `AI_DAILY_CAP` per day.

Without a key the site works normally: search is keyword-only, "If you like this" uses the same genre, and the Ask page says it is not switched on. Tests use an offline fake provider (`AI_PROVIDER=fake`), so they need no key.

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
| GET / PATCH | `/api/me` | Profile; only `displayName` can be changed |
| POST | `/api/orders` | `{ idempotencyKey, currency, lines: [{ formatId, quantity }] }`; `currency` is KRW (default) or USD. Prices come from the database. 201 new, 200 replay |
| GET | `/api/orders`, `/api/orders/:id` | Your own orders only |
| POST | `/api/orders/:id/cancel` | Only while the order is `PAUSED`; stock is put back |
| GET | `/api/admin/orders` | Admin only |
| PATCH | `/api/admin/orders/:id/status` | Admin only. `{ expectedStatus, status }`; PAUSED → IN_PROCESS → DELIVERED, or CANCELLED. Points are awarded once |

Sessions are a signed JWT in an `httpOnly`, `SameSite=Lax` cookie holding only the user id; role and status are re-read from the database on every request. Requests that change data are refused from origins outside `WEB_ORIGINS`. The web app forwards `/api/*` to the API so the cookie stays first-party.

## Checks

```bash
npm run check       # typecheck, lint, tests, build
```

## Deploy

Both apps ship as containers to Google Cloud Run (`apps/*/Dockerfile`, built from the repo root). Do the one-time setup in `docs/gcp-setup.md`, then run the **Deploy to Cloud Run** workflow from GitHub Actions.

How production differs from local development:

- **Covers** go to a private Cloud Storage bucket (`STORAGE_DRIVER=gcs`, `GCS_BUCKET`), because Cloud Run's disk is temporary. The API still serves them at `/api/covers/…`.
- **Secrets** (`DATABASE_URL`, `AUTH_SECRET`, `PROXY_SECRET`, `GEMINI_API_KEY`) come from Secret Manager. The API refuses to start in production if one is missing or covers would be stored on local disk.
- **Migrations** run as a Cloud Run job (`node dist/db/migrate.js`) before each new API version takes traffic. The demo catalogue is loaded only when you tick that option.
- **API address**: the web image is built with `--build-arg API_URL=…`, because Next.js fixes `/api` forwarding at build time.
- **Visitor IPs**: every browser request reaches the API through the website, so the website's middleware names the visitor's IP (from `X-Forwarded-For`, counted `CLIENT_IP_HOPS` from the right) and signs it with `PROXY_SECRET`. The API only believes that header with the right secret, so rate limits apply per visitor.
