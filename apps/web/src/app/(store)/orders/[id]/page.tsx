import { formatMoney, type OrderView, type PaymentConfig } from "@sofiya/shared";
import { CheckCircle2, ExternalLink, Landmark } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { CancelOrderButton } from "@/components/CancelOrderButton";
import { OrderStatusTag } from "@/components/OrderStatusTag";
import { PaymentStatusTag } from "@/components/PaymentStatusTag";
import { PayNowButton } from "@/components/PayNowButton";
import { Container, Notice } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("order"))("title") };
}
export const dynamic = "force-dynamic";

const STEPS = ["PAUSED", "IN_PROCESS", "DELIVERED"] as const;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ placed?: string; paid?: string; payment?: string }>;
}) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}`);
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const query = await searchParams;
  const placed = query.placed === "1";

  let order: OrderView;
  let config: PaymentConfig;
  try {
    [order, config] = await Promise.all([
      apiGet<OrderView>(`/orders/${encodeURIComponent(id)}`, { auth: true }),
      apiGet<PaymentConfig>("/payments/config"),
    ]);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);
  const { payment } = order;
  const awaitingCard = order.status === "PAUSED" && payment.method === "CARD" && payment.status === "UNPAID";
  const awaitingTransfer = order.status === "PAUSED" && payment.method === "BANK_TRANSFER" && payment.status === "UNPAID";
  const expiresAt = new Date(new Date(order.createdAt).getTime() + config.cardTimeoutMinutes * 60_000);

  return (
    <Container className="max-w-[860px]">
      <p className="pt-6 text-sm">
        <Link href="/orders" className="text-ink-3 hover:text-ink">
          ← All orders
        </Link>
      </p>
      {query.paid === "1" && payment.status === "PAID" && (
        <div className="mt-5">
          <Notice tone="ok">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} aria-hidden /> {t("order.paid")}
            </span>
          </Notice>
        </div>
      )}
      {awaitingCard && query.payment === "cancelled" && (
        <div className="mt-5">
          <Notice>{t("order.windowClosed")}</Notice>
        </div>
      )}
      {awaitingCard && query.payment === "error" && (
        <div className="mt-5">
          <Notice tone="bad">{t("order.windowError")}</Notice>
        </div>
      )}
      {placed && (
        <div className="mt-5">
          <Notice tone="ok">
            <span className="flex items-center gap-2">
              <CheckCircle2 size={18} aria-hidden /> {t("order.placed")}
            </span>
          </Notice>
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("order.heading", { ref: order.id.slice(0, 8) })}</h1>
          <p className="mt-1 text-ink-3">{t("order.placedOn", { date: date(order.createdAt) })}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <PaymentStatusTag payment={payment} />
          <OrderStatusTag status={order.status} />
        </div>
      </div>

      {order.status !== "CANCELLED" && (
        <ol className="mt-8 grid grid-cols-3 gap-2" aria-label={t("order.progress")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <span className={`block h-1.5 rounded-full ${i <= stepIndex ? "bg-accent" : "bg-line"}`} />
              <span className={`mt-2 block text-sm ${i <= stepIndex ? "font-semibold" : "text-ink-3"}`}>
                {t(`order.steps.${s}`)}
              </span>
            </li>
          ))}
        </ol>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-extrabold">{t("order.items")}</h2>
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {order.items.map((i) => (
            <li key={i.formatId} className="flex justify-between gap-4 py-3.5 text-[15px]">
              <span>
                <Link href={`/books/${i.bookSlug}`} className="font-semibold hover:text-accent">
                  {i.bookTitle}
                </Link>
                <span className="text-ink-3">
                  {" "}
                  · {t(`labels.format.${i.format}`)} · {formatMoney(i.unitPrice, order.currency)} × {i.quantity}
                </span>
              </span>
              <span className="font-semibold">{formatMoney(i.unitPrice * i.quantity, order.currency)}</span>
            </li>
          ))}
        </ul>
        <dl className="ml-auto mt-4 max-w-[300px] space-y-1.5 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-ink-2">{t("summary.subtotal")}</dt>
            <dd>{formatMoney(order.subtotal, order.currency)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-2">{t("summary.delivery")}</dt>
            <dd>{order.delivery ? formatMoney(order.delivery, order.currency) : t("summary.free")}</dd>
          </div>
          <div className="flex justify-between border-t border-line pt-2 text-lg font-bold">
            <dt>{t("summary.total")}</dt>
            <dd>{formatMoney(order.total, order.currency)}</dd>
          </div>
        </dl>
      </section>

      {awaitingCard && (
        <section className="mt-10 rounded-[14px] border border-accent/40 bg-accent-soft/40 p-5" aria-labelledby="pay-title">
          <h2 id="pay-title" className="font-semibold">{t("order.waiting")}</h2>
          <p className="mt-1 text-[15px] text-ink-2">
            {t("order.waitingText", {
              time: format.dateTime(expiresAt, { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }),
              minutes: config.cardTimeoutMinutes,
            })}
          </p>
          {payment.error && <p className="mt-2 text-[15px] font-medium text-bad">{t("order.lastAttempt", { error: payment.error })}</p>}
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <PayNowButton
              order={order}
              config={config}
              customer={{ id: user.id, email: user.email, name: user.displayName }}
            />
            <CancelOrderButton orderId={order.id} />
          </div>
        </section>
      )}
      {awaitingTransfer && (
        <section className="mt-10 rounded-[14px] border border-line p-5" aria-labelledby="transfer-title">
          <h2 id="transfer-title" className="flex items-center gap-2 font-semibold">
            <Landmark size={18} aria-hidden /> {t("order.transferTitle")}
          </h2>
          {config.bankTransfer.accountNumber ? (
            <dl className="mt-3 grid grid-cols-[130px_1fr] gap-y-1.5 text-[15px]">
              <dt className="text-ink-3">{t("order.amount")}</dt>
              <dd className="font-semibold">{formatMoney(order.total, order.currency)}</dd>
              <dt className="text-ink-3">{t("order.bank")}</dt>
              <dd>{config.bankTransfer.bankName}</dd>
              <dt className="text-ink-3">{t("order.account")}</dt>
              <dd className="font-mono">{config.bankTransfer.accountNumber}</dd>
              <dt className="text-ink-3">{t("order.holder")}</dt>
              <dd>{config.bankTransfer.accountHolder}</dd>
              <dt className="text-ink-3">{t("order.reference")}</dt>
              <dd className="font-mono">{order.id.slice(0, 8)}</dd>
            </dl>
          ) : (
            <p className="mt-1 text-[15px] text-ink-2">{t("order.noBankDetails")}</p>
          )}
          <p className="mt-3 text-[15px] text-ink-2">
            {t("order.transferText")}
          </p>
          <div className="mt-4">
            <CancelOrderButton orderId={order.id} />
          </div>
        </section>
      )}
      {payment.status === "PAID" && (
        <p className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-[15px] text-ink-2">
          <CheckCircle2 size={18} className="text-ok" aria-hidden />
          {payment.method === "CARD" ? t("order.paidByCard") : t("order.paidByTransfer")}
          {payment.paidAt && ` ${t("order.paidOn", { date: date(payment.paidAt) })}`}
          {payment.receiptUrl && (
            <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-accent">
              {t("order.receipt")} <ExternalLink size={14} aria-hidden />
            </a>
          )}
        </p>
      )}
      {payment.status === "REFUNDED" && (
        <p className="mt-8 text-[15px] text-ink-2">{t("order.refunded")}</p>
      )}
      {order.pointsAwarded > 0 && (
        <p className="mt-6 text-[15px] text-ink-2">
          {t("order.points", { count: order.pointsAwarded })}
        </p>
      )}
    </Container>
  );
}
