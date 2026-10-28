import type { AiStatus } from "@sofiya/shared";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { AskChat } from "@/components/AskChat";
import { apiGet } from "@/lib/api";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations();
  return { title: t("common.askSofiya"), description: t("askPage.metaDescription") };
}
export const dynamic = "force-dynamic";

export default async function AskPage() {
  const status = await apiGet<AiStatus>("/ai/status").catch(() => ({ enabled: false, indexedBooks: 0 }));
  return (
    <Suspense>
      <AskChat enabled={status.enabled && status.indexedBooks > 0} configured={status.enabled} />
    </Suspense>
  );
}
