import { formatMoney, OrderStatus, type OrderView, type Page } from "@sofiya/shared";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrderStatusTag } from "@/components/OrderStatusTag";
import { PaymentStatusTag } from "@/components/PaymentStatusTag";
import { ButtonLink, Chip, Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { dateLabel, ORDER_STATUS_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("/orders");
  const parsed = OrderStatus.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;
  const orders = await apiGet<Page<OrderView>>(`/orders?limit=50${status ? `&status=${status}` : ""}`, { auth: true });

  return (
    <Container className="max-w-[900px]">
      <PageTitle>Your orders</PageTitle>
      <nav aria-label="Filter by status" className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Chip href="/orders" active={!status}>
          All
        </Chip>
        {OrderStatus.options.map((s) => (
          <Chip key={s} href={`/orders?status=${s}`} active={status === s}>
            {ORDER_STATUS_LABELS[s]}
          </Chip>
        ))}
      </nav>

      {orders.items.length === 0 ? (
        <div className="mt-8 rounded-[16px] bg-surface px-6 py-14 text-center">
          <Package size={32} className="mx-auto text-ink-3" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold">{status ? "No orders with this status" : "No orders yet"}</h2>
          <p className="mt-2 text-ink-2">When you place an order it will show up here.</p>
          <ButtonLink href="/books" className="mt-6">
            Browse books
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {orders.items.map((o) => (
            <li key={o.id}>
              <Link
                href={`/orders/${o.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-[14px] border border-line p-5 hover:border-ink-3"
              >
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <p className="font-bold">
                    {o.items[0]?.bookTitle}
                    {o.items.length > 1 && <span className="font-normal text-ink-3"> and {o.items.length - 1} more</span>}
                  </p>
                  <p className="text-sm text-ink-3">
                    {dateLabel(o.createdAt)} · {o.items.reduce((n, i) => n + i.quantity, 0)} items · #{o.id.slice(0, 8)}
                  </p>
                </div>
                {o.status === "PAUSED" && o.payment.status === "UNPAID" && <PaymentStatusTag payment={o.payment} />}
                <OrderStatusTag status={o.status} />
                <p className="ml-auto font-bold sm:w-28 sm:text-right">{formatMoney(o.total, o.currency)}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
