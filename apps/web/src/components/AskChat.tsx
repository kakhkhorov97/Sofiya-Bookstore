"use client";

import { BOOK_FORMATS, GENRES, formatMoney, type AskFilters, type AskSource, type Currency } from "@sofiya/shared";
import { ArrowUp, BookOpen, RotateCcw, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Price, useCurrency } from "@/currency/CurrencyProvider";
import { FORMAT_LABELS, GENRE_LABELS } from "@/lib/labels";
import { readEvents, splitCitations } from "@/lib/sse";
import { BookCover } from "./BookCover";
import { Notice } from "./ui";

interface Turn {
  id: number;
  role: "user" | "assistant";
  text: string;
  sources?: AskSource[];
  cited?: string[];
  state?: "streaming" | "done" | "error";
  note?: string;
}

const STARTERS = [
  "Something quiet and strange, set by the sea",
  "A classic mystery I can finish in one evening",
  "Books like Pride and Prejudice but darker",
  "I want to learn programming from scratch",
  "A short horror story for a stormy night",
  "Philosophy that helps with stress",
];

// Follow-ups say exactly what they ask for; length and stock use real filters.
const REFINE: { label: string; message?: string; filters?: AskFilters }[] = [
  { label: "Shorter books", filters: { maxPages: 250 } },
  { label: "Something funnier", message: "Something funnier and lighter, please." },
  { label: "Only books in stock", filters: { inStock: true } },
  { label: "More like the first one", message: "More books like the first one you recommended." },
];

let nextId = 1;

export function AskChat({ enabled, configured }: { enabled: boolean; configured: boolean }) {
  const params = useSearchParams();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const { currency } = useCurrency();
  const [filters, setFilters] = useState<AskFilters>({});
  // A price limit only means something in the currency it was picked in.
  const [filterCurrency, setFilterCurrency] = useState(currency);
  if (filterCurrency !== currency) {
    setFilterCurrency(currency);
    setFilters((f) => ({ ...f, maxPrice: undefined }));
  }
  const [showFilters, setShowFilters] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const abort = useRef<AbortController | null>(null);

  const latestAssistantId = [...turns].reverse().find((t) => t.role === "assistant" && t.sources)?.id;
  const latestSources = [...turns].reverse().find((t) => t.role === "assistant" && t.sources)?.sources ?? [];
  const latestCited = [...turns].reverse().find((t) => t.role === "assistant" && t.cited)?.cited ?? [];

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  useEffect(() => () => abort.current?.abort(), []);

  const update = (id: number, patch: Partial<Turn> | ((t: Turn) => Partial<Turn>)) =>
    setTurns((all) => all.map((t) => (t.id === id ? { ...t, ...(typeof patch === "function" ? patch(t) : patch) } : t)));

  async function send(message: string, filterOverride?: AskFilters, note?: string) {
    const text = message.trim();
    if (!text || busy || !enabled) return;
    const history = turns
      .filter((t) => t.text && t.state !== "error")
      .slice(-6)
      .map((t) => ({ role: t.role, content: t.text.slice(0, 2000) }));
    const userTurn: Turn = { id: nextId++, role: "user", text, note };
    const reply: Turn = { id: nextId++, role: "assistant", text: "", state: "streaming" };
    setTurns((all) => [...all, userTurn, reply]);
    setInput("");
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, history, filters: filterOverride ?? filters, currency }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { message?: string };
        update(reply.id, {
          state: "error",
          text: "",
          note:
            res.status === 429
              ? body.message ?? "You’ve asked a lot of questions in a short time. Please wait a minute."
              : body.message ?? "Ask Sofiya couldn’t answer right now. Please try again.",
        });
        return;
      }
      for await (const event of readEvents(res.body)) {
        if (event.type === "sources") update(reply.id, { sources: event.sources });
        else if (event.type === "delta") update(reply.id, (t) => ({ text: t.text + event.text }));
        else if (event.type === "done") update(reply.id, { state: "done", cited: event.citedBookIds });
        else if (event.type === "error") update(reply.id, { state: "error", note: event.message });
      }
      update(reply.id, (t) => (t.state === "streaming" ? { state: "done" } : {}));
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        update(reply.id, { state: "error", note: "The connection dropped. Please try again." });
      }
    } finally {
      setBusy(false);
    }
  }

  // ?q= from the homepage starts the conversation.
  useEffect(() => {
    const q = params.get("q");
    if (q && !started.current && enabled) {
      started.current = true;
      void send(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, enabled]);

  function reset() {
    abort.current?.abort();
    setTurns([]);
    setBusy(false);
  }

  const activeFilters = Object.values(filters).filter((v) => v !== undefined && v !== false).length;

  return (
    <div className="mx-auto w-[min(1240px,calc(100%-32px))] py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">
            <Sparkles className="text-accent" size={34} aria-hidden /> Ask Sofiya
          </h1>
          <p className="mt-2 max-w-[60ch] text-ink-2">
            Describe what you’re in the mood for. Sofiya searches our catalogue by meaning and recommends only books we
            stock, with a reason for each.
          </p>
        </div>
        {turns.length > 0 && (
          <button type="button" onClick={reset} className="inline-flex items-center gap-2 text-sm font-semibold text-ink-2 hover:text-ink">
            <RotateCcw size={16} aria-hidden /> New conversation
          </button>
        )}
      </div>

      {!enabled && (
        <div className="mt-6">
          <Notice tone="accent">
            {configured
              ? "Ask Sofiya is warming up: the catalogue hasn’t been indexed yet."
              : "Ask Sofiya isn’t switched on yet."}{" "}
            Meanwhile, <Link href="/books" className="font-semibold underline">search the catalogue</Link>.
          </Notice>
        </div>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Conversation" className="min-w-0">
          {turns.length === 0 ? (
            <div className="rounded-[20px] bg-surface p-6 sm:p-8">
              <p className="font-semibold">Try one of these</p>
              <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {STARTERS.map((s) => (
                  <li key={s}>
                    <button
                      type="button"
                      disabled={!enabled}
                      onClick={() => void send(s)}
                      className="w-full rounded-[12px] bg-white px-4 py-3 text-left font-medium shadow-[0_1px_2px_rgba(21,23,28,0.06)] hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      “{s}”
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <ol className="space-y-5" aria-live="polite">
              {turns.map((t) =>
                t.role === "user" ? (
                  <li key={t.id} className="flex flex-col items-end gap-1">
                    <p className="max-w-[80%] rounded-[16px_16px_4px_16px] bg-ink px-4 py-3 font-medium text-white">{t.text}</p>
                    {t.note && <span className="text-xs font-semibold text-ink-3">{t.note}</span>}
                  </li>
                ) : (
                  <li key={t.id}>
                    <AssistantTurn turn={t} latest={t.id === latestAssistantId} />
                  </li>
                ),
              )}
            </ol>
          )}

          {turns.length > 0 && !busy && turns.at(-1)?.state === "done" && (
            <div className="mt-5 flex flex-wrap gap-2" aria-label="Refine">
              {REFINE.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  onClick={() => {
                    if (r.filters) {
                      // Apply the filter and ask the last question again.
                      const merged = { ...filters, ...r.filters };
                      setFilters(merged);
                      const lastQuestion = [...turns].reverse().find((t) => t.role === "user")?.text ?? "";
                      void send(lastQuestion, merged, r.label);
                    } else {
                      void send(r.message ?? r.label);
                    }
                  }}
                  className="h-9 rounded-full border border-line bg-white px-3.5 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink"
                >
                  {r.label}
                </button>
              ))}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="sticky bottom-4 mt-6 rounded-[16px] border-[1.5px] border-ink bg-white p-2 shadow-[0_8px_24px_rgba(21,23,28,0.08)]"
          >
            <div className="flex items-end gap-2">
              <label className="flex-1">
                <span className="sr-only">Describe the book you want</span>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void send(input);
                    }
                  }}
                  rows={1}
                  maxLength={500}
                  disabled={!enabled}
                  placeholder={turns.length ? "Ask a follow-up…" : "e.g. a cosy mystery set in a small village"}
                  className="block max-h-40 min-h-11 w-full resize-none px-3 py-2.5 text-base outline-none disabled:bg-transparent"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowFilters((s) => !s)}
                aria-expanded={showFilters}
                aria-label="Filters"
                className="relative grid size-11 place-items-center rounded-[10px] text-ink-2 hover:bg-surface"
              >
                <SlidersHorizontal size={19} />
                {activeFilters > 0 && (
                  <span className="absolute right-1 top-1 size-4 rounded-full bg-accent text-[10px] font-bold leading-4 text-white">
                    {activeFilters}
                  </span>
                )}
              </button>
              <button
                type="submit"
                disabled={busy || !input.trim() || !enabled}
                aria-label="Send"
                className="grid size-11 place-items-center rounded-[10px] bg-accent text-white hover:bg-accent-ink disabled:bg-line disabled:text-ink-3"
              >
                <ArrowUp size={20} />
              </button>
            </div>
            {showFilters && <FilterBar filters={filters} currency={currency} onChange={setFilters} />}
          </form>
          <p className="mt-3 text-center text-xs text-ink-3">
            Answers are written by AI (Google Gemini) from our catalogue and can be imperfect. Check the book page before
            you buy.
          </p>
          <div ref={bottom} />
        </section>

        <aside aria-label="Books Sofiya found" className="min-w-0 lg:sticky lg:top-24">
          <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Books Sofiya found</h2>
          <p className="mt-1 text-sm text-ink-3">Every number in the answer points to one of these.</p>
          {latestSources.length === 0 ? (
            <div className="mt-4 rounded-[16px] border border-dashed border-line px-5 py-10 text-center text-ink-3">
              <BookOpen className="mx-auto" size={28} aria-hidden />
              <p className="mt-2 text-sm">Matching books will appear here.</p>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {latestSources.map((s) => (
                <SourceCard key={s.book.id} source={s} cited={latestCited.includes(s.book.id)} />
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

// Only the latest answer's numbers match the side panel; older answers link
// straight to the book they cited.
function AssistantTurn({ turn, latest }: { turn: Turn; latest: boolean }) {
  const parts = splitCitations(turn.text);
  const valid = new Set((turn.sources ?? []).map((s) => s.n));
  return (
    <div className="rounded-[16px] border border-line bg-white px-5 py-4">
      <p className="flex items-center gap-2 text-sm font-bold text-accent">
        <Sparkles size={15} aria-hidden /> Sofiya
      </p>
      {turn.text ? (
        <p className="mt-2 whitespace-pre-line leading-relaxed">
          {parts.map((p, i) =>
            typeof p === "number" ? (
              valid.has(p) ? (
                (() => {
                  const book = turn.sources!.find((s) => s.n === p)!.book;
                  return (
                    <a
                      key={i}
                      href={latest ? `#source-${p}` : `/books/${book.slug}`}
                      title={book.title}
                      className="mx-0.5 inline-grid h-5 min-w-5 place-items-center rounded-[5px] bg-accent-soft px-1 align-[1px] text-xs font-bold text-accent-ink hover:bg-accent hover:text-white"
                      aria-label={`${book.title} (book ${p})`}
                    >
                      {p}
                    </a>
                  );
                })()
              ) : null
            ) : (
              <span key={i}>{p}</span>
            ),
          )}
          {turn.state === "streaming" && <span className="ml-0.5 inline-block h-4 w-2 animate-pulse rounded-sm bg-accent align-[-2px]" />}
        </p>
      ) : turn.state === "streaming" ? (
        <p className="mt-2 text-ink-3">
          {turn.sources ? `Found ${turn.sources.length} books. Writing an answer…` : "Searching the catalogue…"}
        </p>
      ) : null}
      {turn.note && <p className="mt-2 text-sm font-medium text-warn">{turn.note}</p>}
    </div>
  );
}

function SourceCard({ source, cited }: { source: AskSource; cited: boolean }) {
  const b = source.book;
  return (
    <li
      id={`source-${source.n}`}
      className={`scroll-mt-28 rounded-[14px] border bg-white p-4 ${cited ? "border-accent ring-[3px] ring-accent-soft" : "border-line"}`}
    >
      <div className="flex gap-4">
        <Link href={`/books/${b.slug}`} className="w-[64px] shrink-0">
          <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} size="sm" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="grid h-5 min-w-5 place-items-center rounded-[5px] bg-accent-soft px-1 text-xs font-bold text-accent-ink">
              {source.n}
            </span>
            {cited && <span className="text-xs font-semibold text-accent">Recommended</span>}
            {!b.inStock && <span className="text-xs font-semibold text-warn">Out of stock</span>}
          </div>
          <Link href={`/books/${b.slug}`} className="mt-1 block font-bold leading-snug hover:text-accent">
            {b.title}
          </Link>
          <p className="text-sm text-ink-3">
            {b.author} · {GENRE_LABELS[b.genre]}
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-ink-2">
            Match
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <span className="block h-full rounded-full bg-accent" style={{ width: `${source.matchPercent}%` }} />
            </span>
            {source.matchPercent}%
          </div>
          <blockquote className="mt-2 rounded-[8px] bg-surface px-3 py-2 text-[13.5px] text-ink-2">“{source.passage}”</blockquote>
          <div className="mt-2.5 flex items-center justify-between">
            <span className="text-sm font-bold">
              <Price prices={b.fromPrice} prefix="from " />
            </span>
            <Link href={`/books/${b.slug}`} className="text-sm font-semibold text-accent hover:text-accent-ink">
              View book →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}

// Price limits per currency: round amounts a reader would actually pick.
const PRICE_LIMITS: Record<Currency, number[]> = {
  KRW: [7_000, 14_000, 20_000, 35_000],
  USD: [500, 1000, 1500, 2500],
};

function FilterBar({
  filters,
  currency,
  onChange,
}: {
  filters: AskFilters;
  currency: Currency;
  onChange: (f: AskFilters) => void;
}) {
  const select = "h-9 rounded-[9px] border border-line bg-white px-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-accent";
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line px-1 pt-3">
      <select
        aria-label="Genre"
        className={select}
        value={filters.genre ?? ""}
        onChange={(e) => onChange({ ...filters, genre: (e.target.value || undefined) as AskFilters["genre"] })}
      >
        <option value="">Any genre</option>
        {GENRES.map((g) => (
          <option key={g} value={g}>
            {GENRE_LABELS[g]}
          </option>
        ))}
      </select>
      <select
        aria-label="Format"
        className={select}
        value={filters.format ?? ""}
        onChange={(e) => onChange({ ...filters, format: (e.target.value || undefined) as AskFilters["format"] })}
      >
        <option value="">Any format</option>
        {BOOK_FORMATS.map((f) => (
          <option key={f} value={f}>
            {FORMAT_LABELS[f]}
          </option>
        ))}
      </select>
      <select
        aria-label="Maximum price"
        className={select}
        value={filters.maxPrice ?? ""}
        onChange={(e) => onChange({ ...filters, maxPrice: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Any price</option>
        {PRICE_LIMITS[currency].map((c) => (
          <option key={c} value={c}>
            Under {formatMoney(c, currency)}
          </option>
        ))}
      </select>
      <select
        aria-label="Length"
        className={select}
        value={filters.maxPages ?? ""}
        onChange={(e) => onChange({ ...filters, maxPages: e.target.value ? Number(e.target.value) : undefined })}
      >
        <option value="">Any length</option>
        {[150, 250, 400].map((p) => (
          <option key={p} value={p}>
            Under {p} pages
          </option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={!!filters.inStock}
          onChange={(e) => onChange({ ...filters, inStock: e.target.checked || undefined })}
          className="size-4 accent-[var(--accent)]"
        />
        In stock
      </label>
      {Object.values(filters).some((v) => v !== undefined) && (
        <button type="button" onClick={() => onChange({})} className="ml-auto text-sm font-semibold text-accent">
          Clear
        </button>
      )}
    </div>
  );
}
