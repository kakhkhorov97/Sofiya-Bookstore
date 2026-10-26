"use client";

import type { AdminBook } from "@sofiya/shared";
import { EyeOff, ExternalLink, FileEdit, PencilLine, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";
import { ManageMenu, type ManageItem } from "./ManageMenu";

type QuickStatus = "LIVE" | "PAUSED" | "DRAFT";

const STATUS_STYLE: Record<QuickStatus, string> = {
  LIVE: "bg-ok-soft text-ok",
  PAUSED: "bg-warn-soft text-warn",
  DRAFT: "bg-surface text-ink-2",
};

const STATUS_MOVES: { to: QuickStatus; label: string; icon: React.ReactNode }[] = [
  { to: "LIVE", label: "Publish (make live)", icon: <Upload size={16} /> },
  { to: "PAUSED", label: "Pause (hide from shop)", icon: <EyeOff size={16} /> },
  { to: "DRAFT", label: "Move to drafts", icon: <FileEdit size={16} /> },
];

async function patchStatus(id: string, status: QuickStatus) {
  await clientApi(`/admin/books/${id}/status`, { method: "PATCH", body: { status } });
}

// Status picker for a books-list row: changes apply at once.
export function BookStatusSelect({ book }: { book: Pick<AdminBook, "id" | "title" | "status"> }) {
  const router = useRouter();
  const [status, setStatus] = useState(book.status as QuickStatus);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: QuickStatus) {
    const previous = status;
    setStatus(next);
    setBusy(true);
    setError(null);
    try {
      await patchStatus(book.id, next);
      router.refresh();
    } catch (err) {
      setStatus(previous);
      setError(err instanceof Error ? err.message : "Could not change the status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <select
        aria-label={`Status of ${book.title}`}
        value={status}
        disabled={busy}
        onChange={(e) => void change(e.target.value as QuickStatus)}
        className={`h-8 cursor-pointer rounded-full border-0 pl-3 pr-7 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 ${STATUS_STYLE[status]}`}
      >
        <option value="LIVE">Live</option>
        <option value="PAUSED">Paused</option>
        <option value="DRAFT">Draft</option>
      </select>
      {error && <p className="mt-1 max-w-[180px] text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}

export function BookActions({ book }: { book: Pick<AdminBook, "id" | "slug" | "title" | "status"> }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const live = book.status === "LIVE";
  const items: ManageItem[] = [
    { kind: "link", label: "Edit book", icon: <PencilLine size={16} />, href: `/admin/books/${book.id}` },
    ...(live
      ? [{ kind: "link" as const, label: "View in shop", icon: <ExternalLink size={16} />, href: `/books/${book.slug}`, external: true }]
      : []),
    { kind: "divider" },
    ...STATUS_MOVES.filter((m) => m.to !== book.status).map(
      (m): ManageItem => ({ kind: "action", label: m.label, icon: m.icon, onSelect: () => void run(() => patchStatus(book.id, m.to)) }),
    ),
    { kind: "divider" },
    {
      kind: "action",
      label: "Delete book",
      icon: <Trash2 size={16} />,
      tone: "danger",
      onSelect: () => {
        if (!confirm(`Delete “${book.title}”? It disappears from the shop; past orders keep their history.`)) return;
        void run(() => clientApi(`/admin/books/${book.id}`, { method: "DELETE" }));
      },
    },
  ];

  return (
    <div className="flex flex-col items-end">
      <ManageMenu items={items} busy={busy} />
      {error && <p className="mt-1 max-w-[200px] text-right text-xs font-medium text-bad">{error}</p>}
    </div>
  );
}
