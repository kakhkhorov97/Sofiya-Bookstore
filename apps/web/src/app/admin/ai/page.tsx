import type { AdminOverview } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminTitle, Panel } from "@/components/admin/bits";
import { ReindexButton } from "@/components/admin/ReindexButton";
import { apiGet } from "@/lib/api";
import { dateLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "AI & search" };

export default async function AdminAiPage() {
  const o = await apiGet<AdminOverview>("/admin/overview", { auth: true });
  const { index } = o;
  const live = index.indexed + index.stale + index.missing;

  return (
    <div className="space-y-6">
      <AdminTitle sub="Ask Sofiya and meaning-based search use an embedding of each live book's title, author, genre and description.">
        AI &amp; search
      </AdminTitle>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Panel title="Index">
          <div className="space-y-5 p-5">
            {!index.enabled ? (
              <p className="text-[15px] text-ink-2">AI is off. Add GEMINI_API_KEY to apps/api/.env and restart the API.</p>
            ) : (
              <>
                <div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-line" aria-hidden>
                    <span className="bg-ok" style={{ width: `${live ? (index.indexed / live) * 100 : 0}%` }} />
                    <span className="bg-[#d99a1c]" style={{ width: `${live ? (index.stale / live) * 100 : 0}%` }} />
                    <span className="bg-bad" style={{ width: `${live ? (index.missing / live) * 100 : 0}%` }} />
                  </div>
                  <p className="mt-2 text-[15px]">
                    <b>{index.indexed}</b> of {live} live books indexed
                    {index.stale > 0 && (
                      <>
                        {" · "}
                        <Link href="/admin/books?index=STALE" className="font-semibold text-warn underline">
                          {index.stale} out of date
                        </Link>
                      </>
                    )}
                    {index.missing > 0 && (
                      <>
                        {" · "}
                        <Link href="/admin/books?index=MISSING" className="font-semibold text-bad underline">
                          {index.missing} not indexed
                        </Link>
                      </>
                    )}
                  </p>
                </div>
                <ReindexButton initial={index.job} enabled={index.enabled} />
                <p className="text-sm text-ink-3">
                  Saving a book re-indexes it automatically in the background. Use the button after bulk changes, or if a
                  run failed. Unchanged books are skipped.
                </p>
              </>
            )}
          </div>
        </Panel>

        <Panel title="Asked, but not in the catalogue">
          {o.unanswered.length === 0 ? (
            <p className="px-5 py-4 text-[15px] text-ink-3">Every question in the last 30 days found matching books.</p>
          ) : (
            <ul className="divide-y divide-line">
              {o.unanswered.map((q) => (
                <li key={q.question} className="flex items-center justify-between gap-3 px-5 py-3 text-[15px]">
                  “{q.question}”<span className="shrink-0 text-sm font-semibold text-ink-3">{q.count}×</span>
                </li>
              ))}
            </ul>
          )}
          <p className="border-t border-line px-5 py-3 text-xs text-ink-3">
            Demand the shop cannot meet yet: a list for restocking.
          </p>
        </Panel>
      </div>

      <Panel title="Recent questions">
        {o.recentQuestions.length === 0 ? (
          <p className="px-5 py-4 text-[15px] text-ink-3">No questions yet.</p>
        ) : (
          <ul className="divide-y divide-line">
            {o.recentQuestions.map((q, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[15px]">
                <span>“{q.question}”</span>
                <span className="text-sm text-ink-3">
                  {q.sourceCount ? `${q.sourceCount} books` : "no match"}
                  {q.fallback && q.sourceCount ? " · answered without AI text" : ""} · {dateLabel(q.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-ink-3">Questions are stored without names or accounts.</p>
      </Panel>
    </div>
  );
}
