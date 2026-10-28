import { formatMoney, OrderStatus, type OrderView, type Page } from "@sofiya/shared";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { OrderStatusTag } from "@/components/OrderStatusTag";
import { PaymentStatusTag } from "@/components/PaymentStatusTag";
import { ButtonLink, Chip, Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("orders"))("title") };
}
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireUser("/orders");
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const parsed = OrderStatus.safeParse((await searchParams).status);
  const status = parsed.success ? parsed.data : undefined;
  const orders = await apiGet<Page<OrderView>>(`/orders?limit=50${status ? `&status=${status}` : ""}`, { auth: true });

  return (
    <Container className="max-w-[900px]">
      <PageTitle>{t("orders.title")}</PageTitle>
      <nav aria-label={t("orders.filter")} className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-1">
        <Chip href="/orders" active={!status}>
          {t("orders.all")}
        </Chip>
        {OrderStatus.options.map((s) => (
          <Chip key={s} href={`/orders?status=${s}`} active={status === s}>
            {t(`labels.orderStatus.${s}`)}
          </Chip>
        ))}
      </nav>

      {orders.items.length === 0 ? (
        <div className="mt-8 rounded-[16px] bg-surface px-6 py-14 text-center">
          <Package size={32} className="mx-auto text-ink-3" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold">{status ? t("orders.noneWithStatus") : t("orders.none")}</h2>
          <p className="mt-2 text-ink-2">{t("orders.noneText")}</p>
          <ButtonLink href="/books" className="mt-6">
            {t("orders.browse")}
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
                    {o.items.length > 1 && <span className="font-normal text-ink-3"> {t("orders.andMore", { count: o.items.length - 1 })}</span>}
                  </p>
                  <p className="text-sm text-ink-3">
                    {format.dateTime(new Date(o.createdAt), { dateStyle: "medium" })} · {t("orders.items", { count: o.items.reduce((n, i) => n + i.quantity, 0) })} · #{o.id.slice(0, 8)}
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
