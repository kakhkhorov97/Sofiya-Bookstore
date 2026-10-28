"use client";

import { ArrowUp, Sparkles, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

const SUGGESTIONS = ["s1", "s2", "s3"] as const;

// Pages where a floating button would get in the way.
const HIDDEN_ON = ["/ask", "/checkout", "/signin", "/signup"];

// Always-visible way into Ask Sofiya: a pill in the corner that opens a
// small box, and hands the question to the full chat page.
export function AskLauncher() {
  const t = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const panelId = useId();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  if (HIDDEN_ON.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;

  function ask(question: string) {
    const q = question.trim();
    if (!q) return;
    setOpen(false);
    setText("");
    router.push(`/ask?q=${encodeURIComponent(q)}`);
  }

  return (
    <div ref={wrap} className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label={t("common.askSofiya")}
          className="w-[min(360px,calc(100vw-32px))] overflow-hidden rounded-[18px] border border-line bg-white shadow-[0_24px_60px_rgba(21,23,28,0.2)]"
        >
          <div className="flex items-start justify-between gap-3 bg-accent px-4 py-3.5 text-white">
            <div>
              <p className="flex items-center gap-1.5 font-display text-lg font-extrabold">
                <Sparkles size={18} aria-hidden /> {t("common.askSofiya")}
              </p>
              <p className="text-sm text-white/80">{t("askLauncher.intro")}</p>
            </div>
            <button
              type="button"
              aria-label={t("common.close")}
              onClick={() => setOpen(false)}
              className="grid size-8 shrink-0 place-items-center rounded-full hover:bg-white/15"
            >
              <X size={18} />
            </button>
          </div>
          <form
            className="p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(text);
            }}
          >
            <div className="flex items-end gap-2 rounded-[12px] border border-line p-1.5 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent-soft">
              <label className="flex-1">
                <span className="sr-only">{t("askLauncher.question")}</span>
                <textarea
                  ref={inputRef}
                  rows={2}
                  maxLength={500}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      ask(text);
                    }
                  }}
                  placeholder={t("askLauncher.placeholder")}
                  className="block w-full resize-none px-2 py-1.5 text-[15px] outline-none"
                />
              </label>
              <button
                type="submit"
                aria-label={t("askLauncher.ask")}
                disabled={!text.trim()}
                className="grid size-9 shrink-0 place-items-center rounded-[10px] bg-accent text-white hover:bg-accent-ink disabled:bg-line disabled:text-ink-3"
              >
                <ArrowUp size={18} />
              </button>
            </div>
            <p className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">{t("askLauncher.try")}</p>
            <ul className="space-y-1">
              {SUGGESTIONS.map((key) => t(`askLauncher.suggestions.${key}`)).map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onClick={() => ask(s)}
                    className="w-full rounded-[10px] px-2.5 py-2 text-left text-sm text-ink-2 hover:bg-surface hover:text-ink"
                  >
                    “{s}”
                  </button>
                </li>
              ))}
            </ul>
          </form>
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex h-12 items-center gap-2 rounded-full bg-accent pl-4 pr-5 font-semibold text-white shadow-[0_10px_28px_rgba(59,55,201,0.38)] transition-transform hover:-translate-y-0.5 hover:bg-accent-ink"
      >
        {open ? <X size={18} aria-hidden /> : <Sparkles size={18} aria-hidden />}
        {open ? t("common.close") : t("common.askSofiya")}
        {!open && <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-bold tracking-wide">{t("common.ai")}</span>}
      </button>
    </div>
  );
}
