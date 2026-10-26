"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type ManageItem =
  | { kind: "link"; label: string; icon: React.ReactNode; href: string; external?: boolean }
  | { kind: "action"; label: string; icon: React.ReactNode; onSelect: () => void; tone?: "danger"; disabled?: boolean }
  | { kind: "divider" };

// "Manage ▾" button for table rows. The menu is portalled to <body> with
// fixed positioning, so the table's scroll container cannot clip it.
export function ManageMenu({ items, label = "Manage", busy = false }: { items: ManageItem[]; label?: string; busy?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number; up: boolean } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useLayoutEffect(() => {
    if (!open || !button.current) return;
    const r = button.current.getBoundingClientRect();
    // Open upwards when there is no room below (last rows of a long table).
    const up = window.innerHeight - r.bottom < 280 && r.top > 280;
    setPos({ top: up ? r.top - 6 : r.bottom + 6, right: window.innerWidth - r.right, up });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    const close = () => setOpen(false);
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!menu.current?.contains(t) && !button.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function onMenuKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    const els = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])')];
    const i = els.indexOf(document.activeElement as HTMLElement);
    els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
  }

  const itemClass = "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[14px] hover:bg-surface focus-visible:bg-surface disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex h-8 items-center gap-1 rounded-[8px] border border-line bg-white px-2.5 text-[13px] font-semibold text-ink-2 hover:border-ink-3 hover:text-ink disabled:opacity-50 ${open ? "border-ink-3 text-ink" : ""}`}
      >
        {busy ? "Working…" : label}
        <ChevronDown size={14} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menu}
            id={menuId}
            role="menu"
            onKeyDown={onMenuKey}
            style={{ top: pos.top, right: pos.right, transform: pos.up ? "translateY(-100%)" : undefined }}
            className="fixed z-50 w-[220px] rounded-[12px] border border-line bg-white p-1.5 shadow-[0_16px_40px_rgba(21,23,28,0.16)]"
          >
            {items.map((item, i) => {
              if (item.kind === "divider") return <div key={i} className="my-1 h-px bg-line" role="separator" />;
              const content = (
                <>
                  <span className="text-ink-3" aria-hidden>
                    {item.icon}
                  </span>
                  {item.label}
                </>
              );
              if (item.kind === "link") {
                return (
                  <Link
                    key={i}
                    href={item.href}
                    role="menuitem"
                    target={item.external ? "_blank" : undefined}
                    onClick={() => setOpen(false)}
                    className={`${itemClass} text-ink-2`}
                  >
                    {content}
                  </Link>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={`${itemClass} ${item.tone === "danger" ? "text-bad hover:bg-[#fde8e6]" : "text-ink-2"}`}
                >
                  {content}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
