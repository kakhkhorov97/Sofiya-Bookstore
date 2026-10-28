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
import { getTranslations } from "next-intl/server";
import { BookGrid } from "@/components/BookCard";
import { SortSelect } from "@/components/SortSelect";
import { ButtonLink, Container } from "@/components/ui";
import { getCurrency } from "@/currency/server";
import { apiGet } from "@/lib/api";

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
  const t = await getTranslations();
  if (q.q) return { title: `“${q.q}”` };
  if (q.genre) return { title: t(`labels.genre.${q.genre}`) };
  return { title: t("common.allBooks") };
}

export default async function BooksPage({ searchParams }: { searchParams: SearchParams }) {
  const t = await getTranslations();
  // Price sorting follows the reader's currency cookie, not the URL.
  const query = { ...readParams(await searchParams), currency: await getCurrency() };
  const qs = (overrides: Record<string, string | number | boolean | undefined>) => {
    const merged: Record<string, string> = {};
    const all = { ...query, page: undefined, ...overrides } as Record<string, unknown>;
    for (const [k, v] of Object.entries(all)) {
      if (v === undefined || v === false || v === "" || k === "currency" || (k === "limit" && v === 24)) continue;
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
    ? t("books.resultsFor", { q: query.q })
    : query.staffPicks
      ? t("common.staffPicks")
      : query.genre
        ? t(`labels.genre.${query.genre}`)
        : t("common.allBooks");

  return (
    <Container className="pb-8">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{heading}</h1>
          <p className="mt-2 text-ink-3" aria-live="polite">
            {t("books.count", { count: result.total })}
            {query.format ? ` · ${t(`labels.format.${query.format}`)}` : ""}
            {query.inStock ? ` · ${t("books.inStockNote")}` : ""}
          </p>
        </div>
        <SortSelect
          value={query.sort ?? (query.q ? "relevance" : "popular")}
          options={sorts.map((s) => ({ value: s, label: t(`labels.sort.${s}`) }))}
        />
      </div>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside aria-label={t("books.filters")} className="min-w-0 space-y-8 text-[15px]">
          <form action="/books" role="search" className="lg:hidden">
            <input
              name="q"
              type="search"
              defaultValue={query.q}
              placeholder={t("books.searchPlaceholder")}
              aria-label={t("common.searchBooks")}
              className="w-full rounded-full bg-surface px-4 py-2.5 outline-none focus:ring-2 focus:ring-accent"
            />
          </form>
          <FilterGroup title={t("books.genre")}>
            <FilterLink href={qs({ genre: undefined })} active={!query.genre}>
              {t("books.allGenres")}
            </FilterLink>
            {GENRES.map((g) => (
              <FilterLink key={g} href={qs({ genre: g })} active={query.genre === g}>
                {t(`labels.genre.${g}`)}
                <span className="ml-auto text-ink-3">{genres.find((x) => x.genre === g)?.count ?? 0}</span>
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup title={t("books.format")}>
            <FilterLink href={qs({ format: undefined })} active={!query.format}>
              {t("books.anyFormat")}
            </FilterLink>
            {BOOK_FORMATS.map((f) => (
              <FilterLink key={f} href={qs({ format: f })} active={query.format === f}>
                {t(`labels.format.${f}`)}
              </FilterLink>
            ))}
          </FilterGroup>
          <FilterGroup title={t("books.availability")}>
            <FilterLink href={qs({ inStock: !query.inStock })} active={query.inStock}>
              <span
                aria-hidden
                className={`grid size-4 place-items-center rounded border ${query.inStock ? "border-accent bg-accent text-white" : "border-ink-3"}`}
              >
                {query.inStock ? "✓" : ""}
              </span>
              {t("books.inStockOnly")}
            </FilterLink>
          </FilterGroup>
        </aside>

        <section aria-label={t("books.results")} className="min-w-0">
          {result.items.length > 0 ? (
            <BookGrid books={result.items} />
          ) : (
            <div className="rounded-[16px] bg-surface px-6 py-14 text-center">
              <SearchX size={32} className="mx-auto text-ink-3" aria-hidden />
              <h2 className="mt-3 font-display text-2xl font-extrabold">{t("books.noMatch")}</h2>
              <p className="mx-auto mt-2 max-w-[44ch] text-ink-2">
                {t("books.noMatchText")}
              </p>
              <ButtonLink href="/books" variant="outline" className="mt-6">
                {t("books.clear")}
              </ButtonLink>
            </div>
          )}

          {pages > 1 && (
            <nav aria-label={t("books.pages")} className="mt-12 flex items-center justify-center gap-2">
              <PageLink href={qs({ page: query.page - 1 })} disabled={query.page <= 1}>
                {t("books.previous")}
              </PageLink>
              <span className="px-3 text-sm text-ink-3">
                {t("books.pageOf", { page: query.page, pages })}
              </span>
              <PageLink href={qs({ page: query.page + 1 })} disabled={query.page >= pages}>
                {t("books.next")}
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
