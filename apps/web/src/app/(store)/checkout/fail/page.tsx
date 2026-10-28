import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ButtonLink, Container, Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("paymentResult"))("notCompleted") };
}
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Toss sends the browser here with code, message and orderId when the
// payment is cancelled or refused. Nothing was charged.
export default async function PaymentFailPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/orders");
  const params = await searchParams;
  const t = await getTranslations("paymentResult");
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const code = one(params.code);
  const message = one(params.message);
  const orderId = one(params.orderId);
  const cancelled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";

  return (
    <Container className="max-w-[640px] pb-16">
      <PageTitle>{cancelled ? t("cancelled") : t("notCompleted")}</PageTitle>
      <div className="mt-6 space-y-4">
        <Notice tone={cancelled ? undefined : "bad"}>
          {cancelled ? t("closedWindow") : (message ?? t("notCompletedText"))}
        </Notice>
        <p className="text-ink-2">
          {t("saved")}
        </p>
        {orderId ? (
          <ButtonLink href={`/orders/${orderId}`}>{t("goToOrder")}</ButtonLink>
        ) : (
          <ButtonLink href="/orders">{t("yourOrders")}</ButtonLink>
        )}
      </div>
    </Container>
  );
}
