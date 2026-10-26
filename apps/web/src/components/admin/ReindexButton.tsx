"use client";

import type { IndexJobState } from "@sofiya/shared";
import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { clientApi } from "@/lib/client-api";

// Starts a background re-index and polls until it finishes.
export function ReindexButton({ initial, enabled }: { initial: IndexJobState; enabled: boolean }) {
  const router = useRouter();
  const [job, setJob] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job.running) return;
    const timer = setInterval(async () => {
      const next = await clientApi<IndexJobState>("/admin/ai/index").catch(() => null);
      if (next) {
        setJob(next);
        if (!next.running) router.refresh();
      }
    }, 2000);
    return () => clearInterval(timer);
  }, [job.running, router]);

  async function start() {
    setError(null);
    try {
      await clientApi("/admin/ai/index", { method: "POST" });
      setJob((j) => ({ ...j, running: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start indexing.");
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={start} disabled={!enabled || job.running} className={`${buttonClass.dark} h-10`}>
        <RefreshCw size={16} className={job.running ? "animate-spin" : ""} aria-hidden />
        {job.running ? "Indexing…" : "Re-index changed books"}
      </button>
      {job.lastResult && !job.running && (
        <p className="text-sm text-ink-3">
          Last run: {job.lastResult.embedded} embedded, {job.lastResult.unchanged} unchanged
          {job.lastResult.removed ? `, ${job.lastResult.removed} removed` : ""}.
        </p>
      )}
      {(job.lastError || error) && <p className="text-sm font-medium text-bad">{error ?? job.lastError}</p>}
    </div>
  );
}
