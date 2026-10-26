"use client";

import { Ban, CircleCheck, Coins, Package, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/ui";
import { clientApi } from "@/lib/client-api";
import { ManageMenu, type ManageItem } from "./ManageMenu";

type MemberStatus = "ACTIVE" | "BLOCKED" | "DELETED";

export function MemberActions({
  id,
  name,
  email,
  status,
  points,
}: {
  id: string;
  name: string;
  email: string;
  status: MemberStatus;
  points: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState(false);

  async function run(work: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await work();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the member.");
    } finally {
      setBusy(false);
    }
  }

  const setStatus = (next: MemberStatus) =>
    run(() => clientApi(`/admin/members/${id}/status`, { method: "PATCH", body: { status: next } }));

  const items: ManageItem[] = [
    { kind: "link", label: "View orders", icon: <Package size={16} />, href: `/admin/orders?q=${encodeURIComponent(email)}` },
    { kind: "action", label: "Set reading points", icon: <Coins size={16} />, onSelect: () => setEditingPoints(true), disabled: status === "DELETED" },
    { kind: "divider" },
  ];
  if (status === "ACTIVE") {
    items.push({
      kind: "action",
      label: "Block member",
      icon: <Ban size={16} />,
      onSelect: () => {
        if (confirm(`Block ${name}? They are signed out at once and cannot sign in until unblocked.`)) void setStatus("BLOCKED");
      },
    });
  }
  if (status === "BLOCKED") {
    items.push({ kind: "action", label: "Unblock member", icon: <CircleCheck size={16} />, onSelect: () => void setStatus("ACTIVE") });
  }
  if (status === "DELETED") {
    items.push({ kind: "action", label: "Restore account", icon: <RotateCcw size={16} />, onSelect: () => void setStatus("ACTIVE") });
  } else {
    items.push({
      kind: "action",
      label: "Delete account",
      icon: <Trash2 size={16} />,
      tone: "danger",
      onSelect: () => {
        if (
          confirm(
            `Delete ${name}'s account? They are signed out and cannot sign in. Orders and reviews are kept, and you can restore the account later from the Deleted filter.`,
          )
        )
          void setStatus("DELETED");
      },
    });
  }

  return (
    <div className="flex flex-col items-end">
      <ManageMenu items={items} busy={busy} />
      {error && <p className="mt-1 max-w-[200px] text-right text-xs font-medium text-bad">{error}</p>}
      {editingPoints && (
        <PointsDialog
          name={name}
          initial={points}
          onClose={() => setEditingPoints(false)}
          onSave={async (value) => {
            await clientApi(`/admin/members/${id}/points`, { method: "PATCH", body: { points: value } });
            setEditingPoints(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function PointsDialog({
  name,
  initial,
  onClose,
  onSave,
}: {
  name: string;
  initial: number;
  onClose: () => void;
  onSave: (points: number) => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [value, setValue] = useState(String(initial));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isInteger(parsed) && parsed >= 0 && parsed <= 1_000_000;

  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      className="m-auto w-[min(380px,calc(100vw-32px))] rounded-[16px] p-0 text-left shadow-2xl backdrop:bg-ink/40"
    >
      <form
        method="dialog"
        className="p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!valid) return;
          setSaving(true);
          setError(null);
          try {
            await onSave(parsed);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Could not save the points.");
            setSaving(false);
          }
        }}
      >
        <h2 className="font-display text-xl font-extrabold">Reading points</h2>
        <p className="mt-1 text-sm text-ink-2">Set the points balance for {name}.</p>
        <label className="mt-4 block text-sm font-semibold">
          Points
          <input
            type="number"
            min={0}
            max={1_000_000}
            step={1}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1.5 block h-11 w-full rounded-[10px] border border-line px-3 text-[15px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
          />
        </label>
        <div className="mt-2 flex gap-2">
          {[-10, -1, 1, 10].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setValue(String(Math.max(0, (Number(value) || 0) + d)))}
              className="h-8 flex-1 rounded-[8px] bg-surface text-[13px] font-semibold text-ink-2 hover:bg-line"
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
        </div>
        {error && <p className="mt-2 text-sm font-medium text-bad">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className={`${buttonClass.outline} h-10`}>
            Cancel
          </button>
          <button type="submit" disabled={!valid || saving} className={`${buttonClass.primary} h-10`}>
            {saving ? "Saving…" : "Save points"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
