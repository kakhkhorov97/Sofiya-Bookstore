import type { PaymentConfig } from "@sofiya/shared";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CheckoutView } from "@/components/CheckoutView";
import { ConfirmEmailNotice } from "@/components/EmailConfirmation";
import { Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("checkout"))("title") };
}
export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const config = await apiGet<PaymentConfig>("/payments/config");
  const t = await getTranslations("checkout");
  return (
    <Container>
      <PageTitle sub={t("orderingAs", { name: user.displayName, email: user.email })}>{t("title")}</PageTitle>
      {user.emailVerified ? (
        <CheckoutView config={config} customer={{ id: user.id, email: user.email, name: user.displayName }} />
      ) : (
        <ConfirmEmailNotice />
      )}
    </Container>
  );
}
