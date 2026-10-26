import { AdminOrderListQuery, ORDER_STATUSES, formatMoney, type AdminOrder, type Page } from "@sofiya/shared";
import { Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderActions } from "@/components/admin/OrderActions";
import { AdminTitle, Pager, Panel, td, th } from "@/components/admin/bits";
import { OrderStatusTag } from "@/components/OrderStatusTag";
import { buttonClass } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { dateLabel, FORMAT_LABELS, ORDER_STATUS_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Orders" };

export default async function AdminOrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const parsed = AdminOrderListQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : AdminOrderListQuery.parse({});
  const qs = new URLSearchParams(
    Object.entries(query)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)]),
  );
  const orders = await apiGet<Page<AdminOrder>>(`/admin/orders/detailed?${qs}`, { auth: true });
  const tab = (status?: string) => {
    const next = new URLSearchParams();
    if (status) next.set("status", status);
    if (query.q) next.set("q", query.q);
    const s = next.toString();
    return s ? `/admin/orders?${s}` : "/admin/orders";
  };

  return (
    <div className="space-y-5">
      <AdminTitle sub="Confirm paid orders, mark them delivered or cancel them. Customers can only cancel while an order awaits confirmation.">
        Orders
      </AdminTitle>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="no-scrollbar flex gap-1 overflow-x-auto rounded-[10px] bg-white p-1 shadow-[inset_0_0_0_1px_var(--line)]">
          {[undefined, ...ORDER_STATUSES].map((s) => (
            <Link
              key={s ?? "all"}
              href={tab(s)}
              aria-current={query.status === s ? "page" : undefined}
              className={`shrink-0 rounded-[8px] px-3 py-1.5 text-sm font-semibold ${query.status === s ? "bg-ink text-white" : "text-ink-2 hover:bg-surface"}`}
            >
              {s ? ORDER_STATUS_LABELS[s] : "All"}
            </Link>
          ))}
        </nav>
        <form action="/admin/orders" className="flex flex-1 gap-2">
          {query.status && <input type="hidden" name="status" value={query.status} />}
          <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-line bg-white px-3 text-ink-3 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
            <Search size={16} aria-hidden />
            <span className="sr-only">Search orders</span>
            <input name="q" defaultValue={query.q} placeholder="Customer email, name or order number" className="min-w-0 flex-1 text-[15px] text-ink outline-none" />
          </label>
          <button type="submit" className={`${buttonClass.dark} h-10`}>
            Search
          </button>
        </form>
      </div>

      <Panel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-[14px]">
            <thead className="border-b border-line bg-[#fafaf8]">
              <tr>
                <th className={th}>Order</th>
                <th className={th}>Customer</th>
                <th className={th}>Items</th>
                <th className={`${th} text-right`}>Total</th>
                <th className={th}>Status</th>
                <th className={th}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {orders.items.map((o) => (
                <tr key={o.id} className="align-top hover:bg-surface">
                  <td className={td}>
                    <span className="font-semibold">#{o.id.slice(0, 8)}</span>
                    <span className="block text-[13px] text-ink-3">{dateLabel(o.createdAt)}</span>
                  </td>
                  <td className={td}>
                    <span className="font-medium">{o.customer.name}</span>
                    <span className="block text-[13px] text-ink-3">{o.customer.email}</span>
                  </td>
                  <td className={td}>
                    {o.items.map((i) => (
                      <span key={i.formatId} className="block">
                        {i.bookTitle} <span className="text-ink-3">· {FORMAT_LABELS[i.format]} × {i.quantity}</span>
                      </span>
                    ))}
                  </td>
                  <td className={`${td} text-right font-semibold tabular-nums`}>{formatMoney(o.total, o.currency)}</td>
                  <td className={td}>
                    <OrderStatusTag status={o.status} />
                  </td>
                  <td className={td}>
                    <OrderActions id={o.id} status={o.status} />
                  </td>
                </tr>
              ))}
              {orders.items.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-ink-3">
                    No orders here.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={query.page} total={orders.total} limit={query.limit} href={(p) => `${tab(query.status)}${tab(query.status).includes("?") ? "&" : "?"}page=${p}`} />
      </Panel>
    </div>
  );
}
