"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";
import { buttonClass, Notice } from "./ui";

export function AccountForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("displayName");
    setBusy(true);
    setStatus(null);
    try {
      await clientApi("/me", { method: "PATCH", body: { displayName: name } });
      setStatus({ tone: "ok", text: "Saved." });
      router.refresh();
    } catch (err) {
      setStatus({ tone: "bad", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 max-w-[420px] space-y-3">
      <label className="block text-sm font-semibold">
        Display name
        <input
          name="displayName"
          defaultValue={displayName}
          required
          maxLength={60}
          className="mt-1.5 block h-12 w-full rounded-[10px] border border-line px-3.5 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
        />
      </label>
      <button type="submit" disabled={busy} className={buttonClass.dark}>
        {busy ? "Saving…" : "Save changes"}
      </button>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
    </form>
  );
}
