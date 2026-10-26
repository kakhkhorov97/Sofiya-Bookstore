import type { BookStatus, IndexStatus } from "@sofiya/shared";
import Link from "next/link";
import { Tag } from "@/components/ui";

export function AdminTitle({ children, sub, action }: { children: React.ReactNode; sub?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-[-0.02em]">{children}</h1>
        {sub && <p className="mt-1 text-[15px] text-ink-3">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children, action, className = "" }: { title?: string; children: React.ReactNode; action?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-[14px] border border-line bg-white ${className}`}>
      {title && (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
          <h2 className="font-display text-lg font-extrabold">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

const BOOK_STATUS: Record<BookStatus, { tone: "ok" | "warn" | "muted" | "bad"; label: string }> = {
  LIVE: { tone: "ok", label: "Live" },
  PAUSED: { tone: "warn", label: "Paused" },
  DRAFT: { tone: "muted", label: "Draft" },
  DELETED: { tone: "bad", label: "Deleted" },
};

export function BookStatusTag({ status }: { status: BookStatus }) {
  const s = BOOK_STATUS[status];
  return <Tag tone={s.tone}>{s.label}</Tag>;
}

const INDEX: Record<IndexStatus, { color: string; label: string }> = {
  INDEXED: { color: "bg-ok", label: "Indexed" },
  STALE: { color: "bg-[#d99a1c]", label: "Out of date" },
  MISSING: { color: "bg-bad", label: "Not indexed" },
  NOT_LIVE: { color: "bg-line", label: "Not live" },
  AI_OFF: { color: "bg-line", label: "AI off" },
};

export function IndexBadge({ status }: { status: IndexStatus }) {
  const s = INDEX[status];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[13px] text-ink-2">
      <span className={`size-2 rounded-full ${s.color}`} aria-hidden />
      {s.label}
    </span>
  );
}

export function Pager({ page, total, limit, href }: { page: number; total: number; limit: number; href: (p: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const cls = "rounded-[9px] px-3 py-1.5 text-sm font-semibold shadow-[inset_0_0_0_1px_var(--line)]";
  return (
    <nav aria-label="Pages" className="flex items-center justify-end gap-2 px-5 py-3">
      {page > 1 ? <Link className={cls} href={href(page - 1)}>Previous</Link> : null}
      <span className="text-sm text-ink-3">
        Page {page} of {pages}
      </span>
      {page < pages ? <Link className={cls} href={href(page + 1)}>Next</Link> : null}
    </nav>
  );
}

export const th = "px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.05em] text-ink-3";
export const td = "px-4 py-3 align-middle";
