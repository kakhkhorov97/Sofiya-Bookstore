# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Rebuild (confirmed by owner, 2026-10-26): Next.js App Router frontend, NestJS API, Neon Postgres with pgvector, Gemini (chat + embeddings), deployed on Google Cloud. Mirrors the owner's CargoCheck AI stack. The legacy code (Sofiya-react: CRA + Redux Toolkit + MUI; Sofiya-Bookstore: Express + MongoDB + EJS admin) is reference only and is not modified.

## Users

Global English-speaking readers buying physical and digital books online (hardcover, paperback, ebook, audiobook). Typical job: "I want my next book but don't know its title" — they arrive with a mood, a past favourite, or a vague memory rather than a search term. Secondary user: the single store operator who manages catalogue, stock, orders and members.

## Product Purpose

Sofiya is an online bookstore where readers find their next book by describing what they want and get answers grounded in the real catalogue, then buy it through a basket and order flow. It is also a portfolio piece for the owner (Sean Kakhkhorov), upgrading an earlier "ready to deploy" project into a live, AI-powered product. Success: a visitor goes from a vague request to a cited recommendation to a placed order.

## Positioning

Retrieval-grounded recommendations: every AI answer cites the actual books (and passages of their catalogue data) it came from, and never recommends a title the store does not stock. Neighbouring "AI bookstore" demos generate free-text suggestions; Sofiya's answers are links into its own inventory.

## Operating Context

- Storefront: browse by genre/format, search, book detail, basket, checkout, order tracking (Paused → In process → Delivered), member profile with points.
- Admin: catalogue (up to 5 images per book), stock counts, product status (Pause/Process/Delete), members (Active/Block/Delete).
- RAG pipeline: book metadata + descriptions embedded with Gemini into pgvector; hybrid retrieval; Gemini answers with citations.

## Capabilities and Constraints

- Existing domain: formats HARDCOVER, PAPERBACK, EBOOK, AUDIOBOOK; genres FICTION, ROMANCE, FANTASY, MYSTERY, SCIENCE_FICTION, HORROR, HISTORY, SELF_HELP, PROGRAMMING. Delivery is free from 100, otherwise 5. Members earn a point when an order moves to In process.
- Currency USD.
- Undecided: payment provider (legacy checkout was a mock-up), exact Google Cloud services, catalogue source data.

## Brand Commitments

- Name: Sofiya (also styled "Sofiya Bookstore"). An existing logo lives at Sofiya-react/public/icons/sofiya.png and Sofiya-main.png. The old visual look is not binding.
- Standing preference (owner, 2026-10-26): a clean, simple, user-friendly store interface in the familiar e-commerce pattern, like other bookstore websites. No themed or metaphor-driven visual world. Distinctiveness comes from polish and the AI answer panel, not decoration.

## Evidence on Hand

- No real customers, reviews, sales figures or press. Catalogue titles in the portfolio (e.g. "The Salt Archive", "Orbit of Quiet Things") are fictional demo data and must be labelled as such. Do not invent ratings, testimonials, customer counts or bestseller claims.

## Product Principles

1. Grounded over clever: recommend only what is in stock, and show why.
2. A vague wish is a valid query.
3. The basket and order flow must stay as simple as the AI is capable.
4. The store operator is a real user too.
