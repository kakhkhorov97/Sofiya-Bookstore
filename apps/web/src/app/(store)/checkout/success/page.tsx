import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmPayment } from "@/components/ConfirmPayment";
import { Container, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Confirming payment" };
export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage() {
  await requireUser("/orders");
  return (
    <Container className="pb-16">
      <PageTitle>Payment</PageTitle>
      <Suspense>
        <ConfirmPayment />
      </Suspense>
    </Container>
  );
}
