import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LegalPage } from "@/components/LegalPage";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacy");
  return { title: t("title"), description: t("metaDescription") };
}

export default function PrivacyPage() {
  return (
    <LegalPage
      ns="privacy"
      sections={[
        { id: "collect", list: true, keys: ["account", "google", "orders", "content", "newsletter", "ask", "technical"] },
        { id: "cookies", keys: ["p1", "p2"] },
        { id: "processors", keys: ["p1"] },
        { id: "retention", keys: ["p1"] },
        { id: "rights", keys: ["p1"] },
        { id: "contact", keys: ["p1"] },
      ]}
    />
  );
}
