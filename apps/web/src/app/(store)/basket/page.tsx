import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BasketView } from "@/components/BasketView";
import { Container, PageTitle } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("common"))("basket") };
}

export default async function BasketPage() {
  const t = await getTranslations("basket");
  return (
    <Container>
      <PageTitle>{t("title")}</PageTitle>
      <BasketView />
    </Container>
  );
}
