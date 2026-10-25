import type { AiStatus } from "@sofiya/shared";
import type { Metadata } from "next";
import { Suspense } from "react";
import { AskChat } from "@/components/AskChat";
import { apiGet } from "@/lib/api";

export const metadata: Metadata = {
  title: "Ask Sofiya",
  description: "Describe the book you want and our AI concierge recommends books we stock, with reasons.",
};
export const dynamic = "force-dynamic";

export default async function AskPage() {
  const status = await apiGet<AiStatus>("/ai/status").catch(() => ({ enabled: false, indexedBooks: 0 }));
  return (
    <Suspense>
      <AskChat enabled={status.enabled && status.indexedBooks > 0} configured={status.enabled} />
    </Suspense>
  );
}
