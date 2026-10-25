import type { Metadata } from "next";
import { CheckoutView } from "@/components/CheckoutView";
import { Container, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Checkout" };
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  return (
    <Container>
      <PageTitle sub={`Ordering as ${user.displayName} (${user.email})`}>Checkout</PageTitle>
      <CheckoutView />
    </Container>
  );
}
