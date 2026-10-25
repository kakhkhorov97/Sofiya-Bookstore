# Sofiya AI: redesign, RAG and Google Cloud deploy plan

Owner: Sean Kakhkhorov · Drafted 2026-10-26
Status: plan only. The legacy repos in this folder (`Sofiya-react`, `Sofiya-Bookstore`) are cloned for reference and have **not** been changed, committed or pushed.

Design concepts: [design-concepts/images](design-concepts/images) (HTML sources beside them).

---

## 1. Where Sofiya stands today

### In the portfolio and resume
- Listed as **"Earlier project · Ready to deploy"**, last of five projects (portfolio p.02 and p.26; resume Projects).
- Described as a React/Redux Toolkit storefront plus an Express + MongoDB API with basket, order tracking, JWT sign-in and an EJS admin panel.
- The portfolio already admits two weaknesses: "item prices come from the browser" and "the payment step is a mock-up".
- Every other project is either live or uses Gemini/RAG. Sofiya is the only one with no AI and no deployment, so it currently reads as a training project.

**Goal:** turn Sofiya into the portfolio's **live, RAG-powered e-commerce product**. It would be the only project combining a real shopping flow with grounded retrieval, deployed on Google Cloud, which is a new cloud for the resume.

### What the legacy code does
| Area | Sofiya-react (CRA, TS 4.1) | Sofiya-Bookstore (Express, Mongoose 6) |
|---|---|---|
| Catalogue | Home (popular/new), product list with genre/format filters, search, pagination, product detail with image slider | `GET /product/all` (filters, regex search, sort, paging), `GET /product/:id` with unique view counting |
| Basket and orders | localStorage basket, checkout, orders page with Paused / In process / Delivered tabs | `POST /order/create`, `GET /order/all`, `POST /order/update`; free delivery from 100, otherwise 5; +1 point on In process |
| Members | Sign up/in modal, profile settings with avatar upload, top users | JWT in a cookie (24 h), bcrypt, Multer uploads |
| Admin | — | EJS pages: store sign-in (sessions in MongoDB, 6 h), product list, create with up to 5 images, status edit, user list and status |

### Defects to fix before anything is deployed
Found while reading the code. Several are security issues, so the rebuild must not carry them over.

1. **The build breaks on Linux.** Files import `./Member.service`, but the file is `member.service.ts`. This works on macOS and fails on any case-sensitive server (`Order.service.ts`, `member.contoller.ts`, `store.contoller.ts`).
2. **Prices are trusted from the browser.** `createOrder` totals the client's `itemPrice`, so anyone can buy at any price.
3. **Mass assignment on profile update.** `updateMember` saves the whole `req.body`, so a user can set their own `memberType`, `memberStatus` or `memberPoints`.
4. **Users control their own order status.** `updateOrder` accepts any status, including DELIVERED, and toggling to PROCESS awards a point every time (unlimited points).
5. **Token handling.** The JWT cookie is `httpOnly: false` and its payload is the entire member document. CORS is `origin: true` with credentials.
6. **Regex injection in search.** User input goes straight into `new RegExp(...)`.
7. **No transaction or stock control.** The order and its items are inserted separately, and `productLeftCount` is never decremented.
8. **XSS in the admin.** Error messages are interpolated into `<script>alert("...")</script>` responses.
9. **Smaller issues:** the enum value `PROCESS = "PROSCESS"`; leftover restaurant-template names (`burak`, `getRestaurant`, `PopularDishes`); a session collection named `sesssion`; local-disk uploads (lost on every Cloud Run deploy); outdated dependencies (CRA, react-router 5, MUI 4 and 5 mixed, jsonwebtoken 8); no tests.

---

## 2. Product vision

> **Describe the book you want next, and get answers that cite real books we stock.**

Audience: global English-speaking readers; prices in USD. Design: a clean, conventional and easy-to-use store (owner preference recorded in `PRODUCT.md`). It stands out through the AI answer panel and its citations, not decoration.

### Feature set by release

**v1: Rebuilt store (parity with the old app, done properly)**
- Catalogue: home, browse by genre and format, full-text search, book page with formats and stock.
- Basket and checkout with **totals recomputed on the server**, stock reserved in a transaction, and idempotent order creation (the CreatorHub request-key pattern).
- Orders: Paused → In process → Delivered, changed only by the admin; points awarded once per order.
- Accounts: email sign-in (Auth.js or NestJS JWT with httpOnly cookies), profile, saved books.
- Admin (Next.js, replacing EJS): books CRUD with cover upload to Cloud Storage, orders, members, role guard on the server.

**v2: RAG (the headline feature)**
- **Ask Sofiya concierge:** a natural-language wish → streamed answer with numbered citations → source cards showing match %, the matched passage, stock and an Add-to-basket button.
- **Semantic search** in the main search bar (hybrid ranking replaces the regex).
- **"If you like this, try"** on each book page, from vector similarity.
- **Quick take** on each book page: a spoiler-free summary with sources, generated once and cached.
- **Admin AI:** draft description, genre and keywords from the cover and notes (human approves); an index status per book (Indexed / Out of date / No description); a "What readers asked" report including unanswered queries, which doubles as a restocking signal.

**v3: Commerce and polish**
- Real payments: Stripe test mode first; Toss Payments is an option later if the store targets Korea.
- Order emails (Resend), wishlist alerts ("Notify me when back"), reviews.
- Analytics (PostHog), and an evaluation dashboard for retrieval quality.

---

## 3. Target architecture

```
Browser ── Cloud Load Balancer + Cloud CDN (sofiya.<domain>)
            ├─ /            → Cloud Run: web  (Next.js App Router, SSR + /api/ask SSE proxy)
            └─ /api/*       → Cloud Run: api  (NestJS REST)
                                   ├─ Neon Postgres + pgvector  (catalogue, orders, chunks, embeddings)
                                   ├─ Upstash Redis             (rate limits, daily AI cap, answer cache)
                                   ├─ Gemini API / Vertex AI     (chat + embeddings)
                                   └─ Cloud Storage             (covers, signed uploads)
Cloud Tasks / Cloud Scheduler → api /jobs/reindex   (embed new or edited books)
Secret Manager · Artifact Registry · Cloud Logging/Monitoring
```

### Stack (confirmed)
- **Frontend:** Next.js App Router, TypeScript, Tailwind + shadcn/ui primitives styled to the concept tokens, TanStack Query, Zod.
- **API:** NestJS, Drizzle or Prisma (with the pgvector extension), class-validator/Zod DTOs, Jest + Supertest.
- **Data:** Neon Postgres + `pgvector`; Upstash Redis.
- **AI:** Gemini (chat model and embedding model set by environment variables so they can be swapped without code changes).
- **Infra:** Google Cloud Run (two services), Cloud Storage, Secret Manager, Artifact Registry, Cloud Tasks; CI/CD with GitHub Actions using Workload Identity Federation (no JSON keys).

Monorepo suggestion: `apps/web`, `apps/api`, `packages/shared` (types and Zod schemas), managed with npm workspaces. It lives on the `v2` branch of Sofiya-Bookstore; `develop` keeps the original code.

### Data model (Postgres)
`users` (role USER/ADMIN, status, points) · `books` (title, author, genre, description, pages, published, status) · `book_formats` (book_id, format, price_cents, stock) · `book_images` · `orders` (user_id, status, subtotal_cents, delivery_cents, total_cents, idempotency_key UNIQUE) · `order_items` (format_id, qty, unit_price_cents, copied from the database at checkout) · `book_chunks` (book_id, kind: description/sample/metadata, text, `tsv tsvector`, `embedding vector(768)`, content_hash) · `ai_queries` (query, retrieved ids, cited ids, latency, tokens, feedback) · `views`, `saved_books`.

Money is stored as integer cents. Stock is decremented with `UPDATE … WHERE stock >= qty` inside the order transaction.

---

## 4. RAG design

This reuses what the resume already proves (Korea Visa Assistant: BM25 + vectors + RRF, hit@5/MRR evaluation) and applies it to a catalogue.

1. **Ingest:** for each book, build chunks: a metadata card (title, author, genre, formats, pages), the description, and an optional first-chapter sample. Hash each chunk's content and only re-embed when the hash changes. An edit sets the index status to *Out of date* until the job runs.
2. **Embed:** Gemini embeddings (768 dimensions), batched; jobs are queued through Cloud Tasks and retried with backoff.
3. **Retrieve (hybrid):**
   - Parse hard filters from the query and UI chips (format, max price, max pages, in stock) into a SQL `WHERE` clause **before** ranking.
   - Lexical: Postgres full-text search (`ts_rank_cd`) over `tsv`.
   - Semantic: pgvector cosine top-k (HNSW index).
   - Fuse with **Reciprocal Rank Fusion**, group by book, and keep the top 5 books with their best-matching passage. The passage is what the source cards highlight.
4. **Generate:** Gemini with low temperature and structured JSON output: `{ answer_markdown, citations: [{ n, book_id }], follow_ups: [] }`. The system prompt tells the model to use only the supplied cards, treat card text as data rather than instructions, and say so when nothing fits.
5. **Validate:** the server drops any citation whose `book_id` was not retrieved and removes unknown titles. If validation fails, it retries once, then falls back to plain search results.
6. **Stream:** Server-Sent Events from NestJS through the Next.js route. Source cards are sent first, then answer tokens, matching the "Searching… 2 of 3 matches found" state in the concept.
7. **Guardrails** (the CreatorHub pattern): origin check, 1,500-character limit, per-visitor rate limit and a daily global cap in Redis, a 3.5 s retrieval timeout, a fallback model on 429/5xx, and the API key only on the server.
8. **Evaluate:** a labelled set of about 40 wishes → expected books. Track **hit@5, MRR** and **citation precision** (cited ⊆ retrieved, no invented titles) in CI on every change to the retriever or prompt. These numbers go into the portfolio, labelled honestly as in the Visa Assistant case.

---

## 5. Google Cloud deployment

| Need | Service |
|---|---|
| Run web and api | **Cloud Run** (2 services, min instances 0 to start; 1 for api if cold starts hurt the chat) |
| Images | **Artifact Registry** |
| CI/CD | GitHub Actions → build → push → `gcloud run deploy`, authenticated with **Workload Identity Federation** |
| Secrets | **Secret Manager** (DATABASE_URL, GEMINI_API_KEY, AUTH_SECRET, UPSTASH_*), mounted into Cloud Run |
| Covers and uploads | **Cloud Storage** bucket with signed upload URLs; public read through **Cloud CDN** |
| Background jobs | **Cloud Tasks** (re-index queue) + **Cloud Scheduler** (nightly consistency sweep) |
| Domain and TLS | Cloud Run domain mapping, or an HTTPS Load Balancer with a managed certificate (DNS stays on Cloudflare if preferred) |
| Observability | Cloud Logging + Error Reporting; uptime check on `/health`; a log-based metric for AI latency and cost |
| Database | **Neon** (external, pgvector built in). Cloud SQL for Postgres with pgvector is the all-Google alternative if you want everything on one bill. |
| AI | Gemini through Google AI Studio key to start; switch to **Vertex AI** with a service-account identity once on GCP (no API key to leak, billed to the project) |

Release flow (as in CreatorHub): every push runs install → typecheck → lint → tests → build. Deploys are a manual workflow that deploys a specific commit pair. Cloud Run keeps previous revisions, so a rollback is moving traffic back to the last healthy revision.

Cost guardrails: set a billing budget alert; use min instances 0; keep a daily AI cap in Redis.

---

## 6. Milestones

| # | Milestone | Done when |
|---|---|---|
| 0 | **Setup** | New monorepo, CI green on an empty app, GCP project, Artifact Registry, Workload Identity Federation, Neon database, secrets |
| 1 | **Data and API core** | Schema and migrations, seed of about 60 demo books (labelled fictional), books/formats endpoints, auth with httpOnly cookies, tests for every defect in §1 (each has a regression test) |
| 2 | **Storefront v1** | Home, browse, search, book page, basket, checkout with server totals and stock transaction, orders, profile, built from the concept designs |
| 3 | **Admin v1** | Books CRUD with Cloud Storage uploads, orders status, members, server role guard |
| 4 | **First deploy** | Both services on Cloud Run behind the domain, health checks, rollback rehearsed |
| 5 | **RAG** | Ingest pipeline, hybrid retrieval, Ask Sofiya with streaming and citations, semantic search, "If you like this", eval set in CI with recorded hit@5/MRR |
| 6 | **Admin AI and polish** | AI drafts, index status, "What readers asked", accessibility pass, mobile pass |
| 7 | **Payments and launch** | Stripe test mode, order emails, analytics; update portfolio and resume |

---

## 7. Portfolio and resume updates after launch

- Move Sofiya from "Earlier project · Ready to deploy" to **"Live · RAG · Google Cloud"**.
- New case-study slides: (1) grounded concierge flow with citation validation, (2) hybrid retrieval and eval numbers, (3) server-side pricing and stock transaction (the "what I would change now" note in the current portfolio, now done), (4) Cloud Run deployment and rollback.
- Resume bullet draft: *"Rebuilt a bookstore as a Next.js + NestJS app on Google Cloud Run with a Gemini RAG concierge (pgvector + full-text, RRF) that only cites stocked books; server-side pricing and stock transactions; hit@5 X / MRR Y on N labelled queries."* Fill in X, Y and N from real measurements only.

---

## 8. Open decisions

1. Neon (chosen) vs Cloud SQL: fine to keep Neon; revisit only if you want a single Google bill.
2. Gemini via AI Studio key vs Vertex AI: start with AI Studio for speed, move to Vertex during milestone 4.
3. Catalogue data: fully fictional demo books, or real public-domain titles (e.g. from Project Gutenberg metadata) for more convincing RAG demos?
4. Payments: Stripe test mode only for the portfolio, or a real provider?
5. Domain name for the live site.
