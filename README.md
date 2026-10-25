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

## Website pages

`/` home · `/books` browse, search and filter · `/books/:slug` book page · `/basket` · `/checkout` · `/orders`, `/orders/:id` · `/account` · `/signin`, `/signup`.

The basket lives in the browser (localStorage) and is re-priced from the API on every view; checkout sends one idempotency key per basket so a double click cannot create two orders.

## AI: Ask Sofiya (RAG with Gemini)

1. Get a key at https://aistudio.google.com and add it to `apps/api/.env`: `GEMINI_API_KEY=...`
2. Embed the catalogue (re-run after adding or editing books; unchanged books are skipped):

   ```bash
   npm run ai:index -w @sofiya/api
   ```
3. Start the site with `npm run dev` and open http://localhost:3000/ask.

How it works: each book's title, author, genre and description is embedded (Gemini, 768 dimensions) into `book_embeddings` (pgvector, HNSW index). A question is matched by meaning (cosine similarity, above `AI_MIN_SIMILARITY`) and by keywords (Postgres full text, any word, plus partial title/author), and the two rankings are fused with Reciprocal Rank Fusion. The top 5 books are sent to Gemini with a prompt that allows recommending only those numbered books; the server keeps only citations that point at them. No candidates means no model call. If Gemini fails, the matching books are still shown. Limits: `AI_RATE_LIMIT` questions per minute per visitor and `AI_DAILY_CAP` per day.

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
| GET | `/api/books` | `q`, `genre`, `format`, `inStock`, `sort` (relevance, newest, title, price_asc, price_desc, popular), `page`, `limit` (max 60) |
| GET | `/api/books/:slug` | Details with formats, prices and stock flags |
| GET | `/api/genres` | Live book count per genre |
| GET | `/api/formats?ids=a,b` | Current price, stock and availability for basket lines |
| GET | `/api/books/:slug/similar` | "If you like this": nearest books by meaning (same-genre fallback) |
| GET | `/api/authors/:slug` | Author page with all live books |
| GET / PUT / DELETE | `/api/books/:slug/reviews` | Reviews; writing needs a confirmed order for the book |
| GET | `/api/wishlist`, `/api/wishlist/ids` | Signed-in reader's saved books |
| PUT / DELETE | `/api/wishlist/:bookId` | Save or remove a book |
| POST | `/api/newsletter` | `{ email }`; 201 new, 200 already subscribed |
| GET | `/api/ai/status` | Whether AI is on and how many books are indexed |
| POST | `/api/ask` | Ask Sofiya; server-sent events: `sources`, `delta`…, `done` |
| POST | `/api/auth/signup` | `{ email, password, displayName }`; sets the session cookie |
| POST | `/api/auth/signin` | `{ email, password }`; rate limited per IP |
| POST | `/api/auth/signout` | Clears the session cookie |
| GET / PATCH | `/api/me` | Profile; only `displayName` can be changed |
| POST | `/api/orders` | `{ idempotencyKey, lines: [{ formatId, quantity }] }`. Prices come from the database. 201 new, 200 replay |
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
