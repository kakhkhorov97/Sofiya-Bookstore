import { AdminMemberListQuery, type AdminMember, type Page } from "@sofiya/shared";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MemberActions } from "@/components/admin/MemberActions";
import { AdminTitle, Pager, Panel, td, th } from "@/components/admin/bits";
import { buttonClass, Tag } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { dateLabel } from "@/lib/labels";
import { getCurrentUser } from "@/lib/session";
import { formatPrices } from "@/currency/currency";

export const metadata: Metadata = { title: "Members" };

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const parsed = AdminMemberListQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : AdminMemberListQuery.parse({});
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const [members, me] = await Promise.all([apiGet<Page<AdminMember>>(`/admin/members?${qs}`, { auth: true }), getCurrentUser()]);
  const base = (over: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged = { q: query.q, status: query.status, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) next.set(k, v);
    const s = next.toString();
    return s ? `/admin/members?${s}` : "/admin/members";
  };

  return (
    <div className="space-y-5">
      <AdminTitle sub={`${members.total} ${members.total === 1 ? "member" : "members"}`}>Members</AdminTitle>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="flex gap-1 rounded-[10px] bg-white p-1 shadow-[inset_0_0_0_1px_var(--line)]">
          {[
            [undefined, "All"],
            ["ACTIVE", "Active"],
            ["BLOCKED", "Blocked"],
            ["DELETED", "Deleted"],
          ].map(([s, label]) => (
            <Link
              key={label}
              href={base({ status: s })}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-semibold ${query.status === s ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form action="/admin/members" className="flex flex-1 gap-2">
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-white px-3 text-ink-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search members</span>
            <input name="q" defaultValue={query.q} placeholder="Name or email" className="min-w-0 flex-1 text-[15px] text-ink outline-none" />
          </label>
          <button type="submit" className={`${buttonClass.dark} h-10`}>
            Search
          </button>
        </form>
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead className="border-b border-line bg-[#fafaf8]">
              <tr>
                <th className={th}>Member</th>
                <th className={th}>Joined</th>
                <th className={`${th} text-right`}>Orders</th>
                <th className={`${th} text-right`}>Spent</th>
                <th className={`${th} text-right`}>Points</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {members.items.map((m) => (
                <tr key={m.id} className="hover:bg-surface">
                  <td className={td}>
                    <span className="font-medium">{m.displayName}</span>
                    {m.role === "ADMIN" && <span className="ml-2 text-xs font-bold text-accent">ADMIN</span>}
                    <span className="block text-[13px] text-ink-3">{m.email}</span>
                  </td>
                  <td className={td}>{dateLabel(m.createdAt)}</td>
                  <td className={`${td} text-right tabular-nums`}>
                    {m.orderCount > 0 ? (
                      <Link href={`/admin/orders?q=${encodeURIComponent(m.email)}`} className="font-semibold text-accent">
                        {m.orderCount}
                      </Link>
                    ) : (
                      0
                    )}
                  </td>
                  <td className={`${td} text-right tabular-nums`}>{formatPrices(m.spent, { skipZero: true })}</td>
                  <td className={`${td} text-right tabular-nums`}>{m.points}</td>
                  <td className={td}>
                    <Tag tone={m.status === "ACTIVE" ? "ok" : m.status === "BLOCKED" ? "bad" : "muted"}>
                      {m.status === "ACTIVE" ? "Active" : m.status === "BLOCKED" ? "Blocked" : "Deleted"}
                    </Tag>
                  </td>
                  <td className={`${td} text-right`}>
                    {m.role !== "ADMIN" && m.id !== me?.id ? (
                      <MemberActions id={m.id} name={m.displayName} email={m.email} status={m.status} points={m.points} />
                    ) : (
                      <span className="text-xs text-ink-3">{m.id === me?.id ? "You" : "Admin"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {members.items.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-ink-3">
                    No members match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={query.page} total={members.total} limit={query.limit} href={(p) => `${base({})}${base({}).includes("?") ? "&" : "?"}page=${p}`} />
      </Panel>
    </div>
  );
}
