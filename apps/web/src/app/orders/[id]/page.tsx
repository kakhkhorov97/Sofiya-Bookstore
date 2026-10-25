import { formatUsd, type OrderView } from "@sofiya/shared";
import { CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { OrderStatusTag } from "@/components/OrderStatusTag";
import { Container, Notice } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";
import { dateLabel, FORMAT_LABELS } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const STEPS = ["PAUSED", "IN_PROCESS", "DELIVERED"] as const;
const STEP_LABELS = { PAUSED: "Placed", IN_PROCESS: "Confirmed", DELIVERED: "Delivered" };

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string }>;
}) {
  const { id } = await params;
  await requireUser(`/orders/${id}`);
  const placed = (await searchParams).placed === "1";

  let order: OrderView;
  try {
    order = await apiGet<OrderView>(`/orders/${encodeURIComponent(id)}`, { auth: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  return (
    <Container className="max-w-[860px]">
      <p className="pt-6 text-sm">
        <Link href="/orders" className="text-ink-3 hover:text-ink">
          ← All orders
        </Link>
      </p>
      {placed && (
        <div className="mt-5">
          <Notice tone="ok">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} aria-hidden /> Thank you! Your order has been placed.
            </span>
          </Notice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Order #{order.id.slice(0, 8)}</h1>
          <p className="mt-1 text-ink-3">Placed {dateLabel(order.createdAt)}</p>
        </div>
        <OrderStatusTag status={order.status} />
      </div>

      {order.status !== "CANCELLED" && (
        <ol className="mt-8 grid grid-cols-3 gap-2" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s}>
              <span className={`block h-1.5 rounded-full ${i <= stepIndex ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 block text-sm ${i <= stepIndex ? "font-semibold" : "text-ink-3"}`}>
                {STEP_LABELS[s]}
              </span>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold">Items</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {order.items.map((i) => (
            <li key={i.formatId} className="flex justify-between gap-4 py-3.5 text-[15px]">
              <span>
                <Link href={`/books/${i.bookSlug}`} className="font-semibold hover:text-accent">
                  {i.bookTitle}
                </Link>
                <span className="text-ink-3">
                  {" "}
                  · {FORMAT_LABELS[i.format]} · {formatUsd(i.unitPriceCents)} × {i.quantity}
                </span>
              </span>
              <span className="font-semibold">{formatUsd(i.unitPriceCents * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-[300px] space-y-1.5 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">Subtotal</dt>
            <dd>{formatUsd(order.subtotalCents)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">Delivery</dt>
            <dd>{order.deliveryCents ? formatUsd(order.deliveryCents) : "Free"}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold">
            <dt>Total</dt>
            <dd>{formatUsd(order.totalCents)}</dd>
          </div>
        </dl>
      </section>

      {order.status === "PAUSED" && (
        <div className="mt-10 rounded-[14px] border border-line p-5">
          <p className="font-semibold">Waiting for the store to confirm</p>
          <p className="mt-1 text-[15px] text-ink-2">You can cancel this order until it is confirmed.</p>
          <div className="mt-4">
            <CancelOrderButton orderId={order.id} />
          </div>
        </div>
      )}
      {order.pointsAwarded > 0 && (
        <p className="mt-6 text-[15px] text-ink-2">
          You earned {order.pointsAwarded} {order.pointsAwarded === 1 ? "point" : "points"} with this order.
        </p>
      )}
    </Container>
  );
}
