# Sofiya AI

An online bookstore where readers describe the book they want and get answers that cite books the store actually stocks. This rebuilds the earlier Sofiya-react + Sofiya-Bookstore project. See `../PLAN.md` for the full plan and `../design-concepts/` for the designs.

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
pnpm build:shared
pnpm dev            # web on :3000, api on :8080
```

Health checks: `http://localhost:8080/api/health` and `http://localhost:3000/api/health`.

## Checks

```bash
pnpm check          # typecheck, lint, tests, build
```

## Deploy

Both apps ship as containers to Google Cloud Run (`apps/*/Dockerfile`, built from the repo root). Do the one-time setup in `docs/gcp-setup.md`, then run the **Deploy to Cloud Run** workflow from GitHub Actions.
