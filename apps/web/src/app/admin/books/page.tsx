import { AdminBookListQuery, BOOK_STATUSES, type AdminBook, type Page } from "@sofiya/shared";
import { Plus, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTitle, BookStatusTag, IndexBadge, Pager, Panel, td, th } from "@/components/admin/bits";
import { BookCover } from "@/components/BookCover";
import { buttonClass } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { FORMAT_LABELS, GENRE_LABELS } from "@/lib/labels";
import { formatPrices } from "@/currency/currency";

export const metadata: Metadata = { title: "Books" };

type SP = Promise<Record<string, string | undefined>>;

export default async function AdminBooksPage({ searchParams }: { searchParams: SP }) {
  const raw = await searchParams;
  const parsed = AdminBookListQuery.safeParse(raw);
  const query = parsed.success ? parsed.data : AdminBookListQuery.parse({});
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const books = await apiGet<Page<AdminBook>>(`/admin/books?${qs}`, { auth: true });
  const href = (over: Record<string, string | number | undefined>) => {
    const next = new URLSearchParams(qs);
    next.delete("page");
    for (const [k, v] of Object.entries(over)) {
      if (v === undefined || v === "") next.delete(k);
      else next.set(k, String(v));
    }
    const s = next.toString();
    return s ? `/admin/books?${s}` : "/admin/books";
  };

  const select = "h-10 rounded-[9px] border border-line bg-white px-3 text-sm font-medium";

  return (
    <div className="space-y-5">
      <AdminTitle
        sub={`${books.total} ${books.total === 1 ? "book" : "books"}`}
        action={
          <Link href="/admin/books/new" className={`${buttonClass.primary} h-10`}>
            <Plus size={18} aria-hidden /> Add book
          </Link>
        }
      >
        Books
      </AdminTitle>

      <form className="flex flex-wrap gap-2" action="/admin/books">
        <label className="flex h-10 min-w-[240px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-white px-3 text-ink-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
          <Search size={16} aria-hidden />
          <span className="sr-only">Search books</span>
          <input name="q" defaultValue={query.q} placeholder="Title, author or slug" className="min-w-0 flex-1 text-[15px] text-ink outline-none" />
        </label>
        <select name="status" defaultValue={query.status ?? ""} className={select} aria-label="Status">
          <option value="">Any status</option>
          {BOOK_STATUSES.filter((s) => s !== "DELETED").map((s) => (
            <option key={s} value={s}>
              {s.charAt(0) + s.slice(1).toLowerCase()}
            </option>
          ))}
        </select>
        <select name="index" defaultValue={query.index ?? ""} className={select} aria-label="AI index">
          <option value="">Any index status</option>
          <option value="INDEXED">Indexed</option>
          <option value="STALE">Out of date</option>
          <option value="MISSING">Not indexed</option>
        </select>
        <button type="submit" className={`${buttonClass.dark} h-10`}>
          Filter
        </button>
        {(query.q || query.status || query.index) && (
          <Link href="/admin/books" className={`${buttonClass.outline} h-10`}>
            Clear
          </Link>
        )}
      </form>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-[14px]">
            <thead className="border-b border-line bg-[#fafaf8]">
              <tr>
                <th className={th}>Book</th>
                <th className={th}>Genre</th>
                <th className={th}>Formats</th>
                <th className={th}>Status</th>
                <th className={th}>AI index</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {books.items.map((b) => (
                <tr key={b.id} className="hover:bg-surface">
                  <td className={td}>
                    <Link href={`/admin/books/${b.id}`} className="flex items-center gap-3">
                      <span className="w-9 shrink-0">
                        <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} size="sm" />
                      </span>
                      <span>
                        <span className="block font-semibold hover:text-accent">{b.title}</span>
                        <span className="text-[13px] text-ink-3">{b.author}</span>
                      </span>
                    </Link>
                  </td>
                  <td className={td}>{GENRE_LABELS[b.genre]}</td>
                  <td className={`${td} tabular-nums`}>
                    {b.formats.map((f) => (
                      <span key={f.id} className="mr-3 inline-block whitespace-nowrap">
                        {FORMAT_LABELS[f.format]} {formatPrices(f.price)}
                        {f.stock !== null && (
                          <span className={f.stock === 0 ? "text-bad" : f.stock <= 5 ? "text-warn" : "text-ink-3"}> ({f.stock})</span>
                        )}
                      </span>
                    ))}
                  </td>
                  <td className={td}>
                    <BookStatusTag status={b.status} />
                  </td>
                  <td className={td}>
                    <IndexBadge status={b.indexStatus} />
                  </td>
                </tr>
              ))}
              {books.items.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-ink-3">
                    No books match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={query.page} total={books.total} limit={query.limit} href={(p) => `${href({})}${href({}).includes("?") ? "&" : "?"}page=${p}`} />
      </Panel>
    </div>
  );
}
