import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("terms");
  return { title: t("title"), description: t("metaDescription") };
}

export default function TermsPage() {
  return (
    <LegalPage
      ns="terms"
      sections={["demo", "accounts", "orders", "reviews", "ai", "availability", "liability", "changes", "contact"].map((id) => ({
        id,
        keys: ["p1"],
      }))}
    />
  );
}
