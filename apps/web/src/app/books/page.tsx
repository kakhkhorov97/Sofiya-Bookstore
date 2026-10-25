import {
  BOOK_FORMATS,
  BOOK_SORTS,
  BookListQuery,
  GENRES,
  type BookSummary,
  type GenreCount,
  type Page,
} from "@sofiya/shared";
import { SearchX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookGrid } from "@/components/BookCard";
import { SortSelect } from "@/components/SortSelect";
import { ButtonLink, Container } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { FORMAT_LABELS, GENRE_LABELS, SORT_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function readParams(raw: Record<string, string | string[] | undefined>) {
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v),
  );
  const parsed = BookListQuery.safeParse(flat);
  // A hand-edited URL with a bad value falls back to the defaults.
  return parsed.success ? parsed.data : BookListQuery.parse({});
}

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = readParams(await searchParams);
  if (q.q) return { title: `“${q.q}”` };
  if (q.genre) return { title: GENRE_LABELS[q.genre] };
  return { title: "All books" };
}

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const query = readParams(await searchParams);
  const qs = (overrides: Record<string, string | number | boolean | undefined>) => {
    const merged: Record<string, string> = {};
    const all = { ...query, page: undefined, ...overrides } as Record<string, unknown>;
    for (const [k, v] of Object.entries(all)) {
      if (v === undefined || v === false || v === "" || (k === "limit" && v === 24)) continue;
      merged[k] = String(v);
    }
    const s = new URLSearchParams(merged).toString();
    return s ? `/books?${s}` : "/books";
  };

  const apiQs = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== false)
      .map(([k, v]) => [k, String(v)]),
  );
  const [result, genres] = await Promise.all([
    apiGet<Page<BookSummary>>(`/books?${apiQs.toString()}`),
    apiGet<GenreCount[]>("/genres", { revalidate: 60 }),
  ]);
  const pages = Math.max(1, Math.ceil(result.total / result.limit));
  const sorts = BOOK_SORTS.filter((s) => s !== "relevance" || query.q);
  const heading = query.q
    ? `Results for “${query.q}”`
    : query.staffPicks
      ? "Staff picks"
      : query.genre
        ? GENRE_LABELS[query.genre]
        : "All books";

  return (
    <Container className="pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{heading}</h1>
          <p className="mt-2 text-ink-3" aria-live="polite">
            {result.total} {result.total === 1 ? "book" : "books"}
            {query.format ? ` · ${FORMAT_LABELS[query.format]}` : ""}
            {query.inStock ? " · in stock" : ""}
          </p>
        </div>
        <SortSelect
          value={query.sort ?? (query.q ? "relevance" : "popular")}
          options={sorts.map((s) => ({ value: s, label: SORT_LABELS[s] }))}
        />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filters" className="min-w-0 space-y-8 text-[15px]">
          <form action="/books" role="search" className="lg:hidden">
            <input
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder="Search title or author"
              aria-label="Search books"
              className="w-full rounded-full bg-surface px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent"
            />
          </form>
          <FilterGroup title="Genre">
            <FilterLink href={qs({ genre: undefined })} active={!query.genre}>
              All genres
            </FilterLink>
            {GENRES.map((g) => (
              <FilterLink key={g} href={qs({ genre: g })} active={query.genre === g}>
                {GENRE_LABELS[g]}
                <span className="ml-auto text-ink-3">{genres.find((x) => x.genre === g)?.count ?? 0}</span>
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup title="Format">
            <FilterLink href={qs({ format: undefined })} active={!query.format}>
              Any format
            </FilterLink>
            {BOOK_FORMATS.map((f) => (
              <FilterLink key={f} href={qs({ format: f })} active={query.format === f}>
                {FORMAT_LABELS[f]}
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup title="Availability">
            <FilterLink href={qs({ inStock: !query.inStock })} active={query.inStock}>
              <span
                aria-hidden
                className={`grid size-4 place-items-center rounded border ${query.inStock ? "border-accent bg-accent text-white" : "border-ink-3"}`}
              >
                {query.inStock ? "✓" : ""}
              </span>
              In stock only
            </FilterLink>
          </FilterGroup>
        </aside>

        <section aria-label="Results" className="min-w-0">
          {result.items.length > 0 ? (
            <BookGrid books={result.items} />
          ) : (
            <div className="rounded-[16px] bg-surface px-6 py-14 text-center">
              <SearchX size={32} className="mx-auto text-ink-3" aria-hidden />
              <h2 className="mt-3 font-display text-2xl font-extrabold">No books match that</h2>
              <p className="mx-auto mt-2 max-w-[44ch] text-ink-2">
                Try fewer words, check the spelling, or remove a filter.
              </p>
              <ButtonLink href="/books" variant="outline" className="mt-6">
                Clear search and filters
              </ButtonLink>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-2">
              <PageLink href={qs({ page: query.page - 1 })} disabled={query.page <= 1}>
                Previous
              </PageLink>
              <span className="px-3 text-sm text-ink-3">
                Page {query.page} of {pages}
              </span>
              <PageLink href={qs({ page: query.page + 1 })} disabled={query.page >= pages}>
                Next
              </PageLink>
            </nav>
          )}
        </section>
      </div>
    </Container>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{title}</h2>
      <ul className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">{children}</ul>
    </div>
  );
}

function FilterLink({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <li className="shrink-0">
      <Link
        href={href}
        aria-current={active ? "true" : undefined}
        className={`flex items-center gap-2 rounded-[9px] px-2.5 py-1.5 ${
          active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:bg-surface hover:text-ink"
        }`}
      >
        {children}
      </Link>
    </li>
  );
}

function PageLink({ href, disabled, children }: { href: string; disabled: boolean; children: React.ReactNode }) {
  if (disabled) {
    return (
      <span aria-disabled className="rounded-[10px] px-4 py-2 font-semibold text-ink-3 opacity-50">
        {children}
      </span>
    );
  }
  return (
    <Link href={href} className="rounded-[10px] px-4 py-2 font-semibold shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink-3)]">
      {children}
    </Link>
  );
}
