import { formatUsd, type AdminOverview } from "@sofiya/shared";
import { AlertTriangle, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTitle, Panel } from "@/components/admin/bits";
import { ReindexButton } from "@/components/admin/ReindexButton";
import { apiGet } from "@/lib/api";
import { dateLabel, FORMAT_LABELS, ORDER_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: { absolute: "Overview · Sofiya admin" } };

export default async function AdminOverviewPage() {
  const o = await apiGet<AdminOverview>("/admin/overview", { auth: true });
  const totalOrders = Object.values(o.orders).reduce((a, b) => a + b, 0);

  const stats = [
    { label: "Waiting for confirmation", value: o.orders.PAUSED, href: "/admin/orders?status=PAUSED", tone: o.orders.PAUSED ? "text-warn" : "" },
    { label: "Revenue (confirmed orders)", value: formatUsd(o.revenueCents), href: "/admin/orders" },
    { label: "Live books", value: o.books.LIVE, href: "/admin/books?status=LIVE" },
    { label: "Members", value: o.members, href: "/admin/members" },
  ];

  return (
    <div className="space-y-6">
      <AdminTitle sub={`${totalOrders} orders in total · ${o.books.DRAFT} drafts · ${o.books.PAUSED} paused books`}>Overview</AdminTitle>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[14px] border border-line bg-white p-5 hover:border-ink-3">
            <p className="text-sm text-ink-3">{s.label}</p>
            <p className={`mt-1 font-display text-3xl font-extrabold ${s.tone ?? ""}`}>{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        <Panel title="Orders by status">
          <ul className="divide-y divide-line">
            {(Object.keys(o.orders) as (keyof typeof o.orders)[]).map((s) => (
              <li key={s}>
                <Link href={`/admin/orders?status=${s}`} className="flex justify-between px-5 py-3 text-[15px] hover:bg-surface">
                  {ORDER_STATUS_LABELS[s]}
                  <span className="font-semibold">{o.orders[s]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="AI search index">
          <div className="space-y-4 p-5">
            {o.index.enabled ? (
              <dl className="grid grid-cols-3 gap-3 text-center">
                {[
                  ["Indexed", o.index.indexed, "text-ok", "INDEXED"],
                  ["Out of date", o.index.stale, "text-warn", "STALE"],
                  ["Not indexed", o.index.missing, "text-bad", "MISSING"],
                ].map(([label, n, tone, key]) => (
                  <Link key={label} href={`/admin/books?index=${key}`} className="rounded-[10px] bg-surface p-3 hover:bg-line">
                    <dd className={`font-display text-2xl font-extrabold ${tone}`}>{n}</dd>
                    <dt className="text-xs text-ink-3">{label}</dt>
                  </Link>
                ))}
              </dl>
            ) : (
              <p className="text-[15px] text-ink-2">AI is off. Add GEMINI_API_KEY to apps/api/.env to enable Ask Sofiya.</p>
            )}
            <ReindexButton initial={o.index.job} enabled={o.index.enabled} />
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Low stock">
          {o.lowStock.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-ink-3">Nothing is running low.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.lowStock.map((s) => (
                <li key={`${s.bookId}-${s.format}`}>
                  <Link href={`/admin/books/${s.bookId}`} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px] hover:bg-surface">
                    <span>
                      <span className="font-semibold">{s.title}</span>
                      <span className="text-ink-3"> · {FORMAT_LABELS[s.format]}</span>
                    </span>
                    <span className={`inline-flex items-center gap-1 font-semibold ${s.stock === 0 ? "text-bad" : "text-warn"}`}>
                      {s.stock === 0 && <AlertTriangle size={15} aria-hidden />}
                      {s.stock === 0 ? "Sold out" : `${s.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="What readers asked Sofiya" action={<Link href="/admin/ai" className="text-sm font-semibold text-accent">All questions</Link>}>
          {o.recentQuestions.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-ink-3">No questions yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.recentQuestions.map((q, i) => (
                <li key={i} className="flex items-start gap-3 px-5 py-3 text-[15px]">
                  <MessageCircleQuestion size={17} className={`mt-0.5 shrink-0 ${q.sourceCount ? "text-accent" : "text-bad"}`} aria-hidden />
                  <span className="min-w-0 flex-1">
                    “{q.question}”
                    <span className="block text-xs text-ink-3">
                      {dateLabel(q.createdAt)} · {q.sourceCount ? `${q.sourceCount} books found` : "no match in the catalogue"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
