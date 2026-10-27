import type { Metadata } from "next";
import { ButtonLink, Container, Notice, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Payment not completed" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Toss sends the browser here with code, message and orderId when the
// payment is cancelled or refused. Nothing was charged.
export default async function PaymentFailPage({ searchParams }: { searchParams: SearchParams }) {
  await requireUser("/orders");
  const params = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const code = one(params.code);
  const message = one(params.message);
  const orderId = one(params.orderId);
  const cancelled = code === "PAY_PROCESS_CANCELED" || code === "USER_CANCEL";

  return (
    <Container className="max-w-[640px] pb-16">
      <PageTitle>{cancelled ? "Payment cancelled" : "Payment not completed"}</PageTitle>
      <div className="mt-6 space-y-4">
        <Notice tone={cancelled ? undefined : "bad"}>
          {cancelled ? "You closed the payment window, so nothing was charged." : (message ?? "The payment was not completed.")}
        </Notice>
        <p className="text-ink-2">
          Your order is saved and waiting for payment. You can pay from the order page, or cancel the order there.
        </p>
        {orderId ? (
          <ButtonLink href={`/orders/${orderId}`}>Go to your order</ButtonLink>
        ) : (
          <ButtonLink href="/orders">Your orders</ButtonLink>
        )}
      </div>
    </Container>
  );
}
