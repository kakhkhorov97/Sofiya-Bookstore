import type { Metadata } from "next";
import { BasketView } from "@/components/BasketView";
import { Container, PageTitle } from "@/components/ui";

export const metadata: Metadata = { title: "Basket" };

export default function BasketPage() {
  return (
    <Container>
      <PageTitle>Your basket</PageTitle>
      <BasketView />
    </Container>
  );
}
