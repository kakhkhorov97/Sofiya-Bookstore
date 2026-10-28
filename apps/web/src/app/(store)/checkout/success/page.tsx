import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { ConfirmPayment } from "@/components/ConfirmPayment";
import { Container, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("paymentResult"))("confirmingTitle") };
}
export const dynamic = "force-dynamic";

export default async function PaymentSuccessPage() {
  await requireUser("/orders");
  return (
    <Container className="pb-16">
      <PageTitle>{(await getTranslations("paymentResult"))("title")}</PageTitle>
      <Suspense>
        <ConfirmPayment />
      </Suspense>
    </Container>
  );
}
