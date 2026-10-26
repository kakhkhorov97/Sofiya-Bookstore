"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";

export function MemberActions({ id, name, status }: { id: string; name: string; status: "ACTIVE" | "BLOCKED" | "DELETED" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocking = status === "ACTIVE";

  async function toggle() {
    if (blocking && !confirm(`Block ${name}? They are signed out at once and cannot sign in until unblocked.`)) return;
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/admin/members/${id}/status`, { method: "PATCH", body: { status: blocking ? "BLOCKED" : "ACTIVE" } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the member.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`h-8 rounded-[8px] px-3 text-[13px] font-semibold disabled:opacity-50 ${
          blocking ? "text-bad hover:bg-[#fde8e6]" : "bg-ink text-white hover:bg-black"
        }`}
      >
        {blocking ? "Block" : "Unblock"}
      </button>
      {error && <p className="mt-1 text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}
