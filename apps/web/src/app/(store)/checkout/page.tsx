import type { PaymentConfig } from "@sofiya/shared";
import type { Metadata } from "next";
import { CheckoutView } from "@/components/CheckoutView";
import { ConfirmEmailNotice } from "@/components/EmailConfirmation";
import { Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const config = await apiGet<PaymentConfig>("/payments/config");
  return (
    <Container>
      <PageTitle sub={`Ordering as ${user.displayName} (${user.email})`}>Checkout</PageTitle>
      {user.emailVerified ? (
        <CheckoutView config={config} customer={{ id: user.id, email: user.email, name: user.displayName }} />
      ) : (
        <ConfirmEmailNotice action="place your order" />
      )}
    </Container>
  );
}
