"use client";

import { CURRENCIES, CURRENCY_LABELS, type Currency } from "@sofiya/shared";
import { Check, Globe } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState } from "react";
import { useCurrency } from "@/currency/CurrencyProvider";
import { LOCALE_LABELS, LOCALES, localeCookie, type Locale } from "@/i18n/locales";

// The globe button in the header: language and currency in one menu.
// A new language reloads the page so everything switches together; a new
// currency re-renders in place.
export function RegionMenu() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const { currency, setCurrency, pending } = useCurrency();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys move between options, like a native menu.
  function onMenuKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitemradio"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  function chooseLocale(l: Locale) {
    if (l === locale) return setOpen(false);
    document.cookie = localeCookie(l);
    window.location.reload();
  }

  function chooseCurrency(c: Currency) {
    if (c !== currency) setCurrency(c);
    setOpen(false);
  }

  const option = (active: boolean) =>
    `flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] hover:bg-surface focus-visible:bg-surface ${
      active ? "font-semibold text-ink" : "text-ink-2"
    }`;

  return (
    // On phones the menu spans the header (the closest positioned box);
    // from sm up it hangs under the button.
    <div ref={wrap} className="sm:relative">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-busy={pending}
        onClick={() => setOpen((o) => !o)}
        title={t("region.label")}
        className={`flex h-10 items-center gap-1.5 rounded-[10px] px-2.5 text-ink-2 hover:bg-surface hover:text-ink ${open ? "bg-surface text-ink" : ""}`}
      >
        <Globe size={20} aria-hidden />
        <span className="hidden text-[13px] font-semibold xl:inline" aria-hidden>
          {LOCALE_LABELS[locale].short} · {CURRENCY_LABELS[currency].symbol}
        </span>
        <span className="sr-only">
          {t("region.label")}: {LOCALE_LABELS[locale].name}, {currency}
        </span>
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={t("region.label")}
          onKeyDown={onMenuKey}
          className="absolute inset-x-4 top-[calc(100%+8px)] z-30 overflow-hidden sm:inset-x-auto sm:right-0 sm:w-[260px] rounded-[16px] border border-line bg-white shadow-[0_18px_48px_rgba(21,23,28,0.14)]"
        >
          <div role="group" aria-label={t("region.language")} className="p-1.5">
            <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3" aria-hidden>
              {t("region.language")}
            </p>
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                role="menuitemradio"
                aria-checked={l === locale}
                lang={l}
                onClick={() => chooseLocale(l)}
                className={option(l === locale)}
              >
                <span className="w-8 text-xs font-bold text-ink-3">{LOCALE_LABELS[l].short}</span>
                <span className="flex-1">{LOCALE_LABELS[l].name}</span>
                {l === locale && <Check size={17} className="text-accent" aria-hidden />}
              </button>
            ))}
          </div>
          <div role="group" aria-label={t("region.currency")} className="border-t border-line p-1.5">
            <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-[0.08em] text-ink-3" aria-hidden>
              {t("region.currency")}
            </p>
            {CURRENCIES.map((c) => (
              <button
                key={c}
                type="button"
                role="menuitemradio"
                aria-checked={c === currency}
                onClick={() => chooseCurrency(c)}
                className={option(c === currency)}
              >
                <span className="w-8 text-xs font-bold text-ink-3">{CURRENCY_LABELS[c].symbol}</span>
                <span className="flex-1">
                  {t(`currency.${c}`)} <span className="text-ink-3">{c}</span>
                </span>
                {c === currency && <Check size={17} className="text-accent" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
