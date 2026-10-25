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

Requires Node 20 and pnpm (`corepack enable`).

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
createdb sofiya_dev && createdb sofiya_test   # local PostgreSQL 15+
pnpm --filter @sofiya/api db:migrate
pnpm --filter @sofiya/api db:seed             # 172 demo books
pnpm --filter @sofiya/api db:create-admin you@example.com "a long password" "Your Name"
pnpm build:shared
pnpm dev            # web on :3000, api on :8080
```

Health checks: `http://localhost:8080/api/health` and `http://localhost:3000/api/health`.

## Database

PostgreSQL via Drizzle ORM. Schema: `apps/api/src/db/schema.ts`; SQL migrations: `apps/api/drizzle/`.

- Change the schema, then `pnpm --filter @sofiya/api db:generate` to write a new migration.
- API tests run against `sofiya_test` (override with `DATABASE_URL_TEST`; the name must end in `_test`).
- The demo catalogue (`apps/api/src/db/seed/catalogue.ts`) is real public-domain books plus freely licensed programming books, with original descriptions. Prices and stock are demo values.

## API

| Method | Path | Notes |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/books` | `q`, `genre`, `format`, `inStock`, `sort` (relevance, newest, title, price_asc, price_desc, popular), `page`, `limit` (max 60) |
| GET | `/api/books/:slug` | Details with formats, prices and stock flags |
| GET | `/api/genres` | Live book count per genre |
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
pnpm check          # typecheck, lint, tests, build
```

## Deploy

Both apps ship as containers to Google Cloud Run (`apps/*/Dockerfile`, built from the repo root). Do the one-time setup in `docs/gcp-setup.md`, then run the **Deploy to Cloud Run** workflow from GitHub Actions.
