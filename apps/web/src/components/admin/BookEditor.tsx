"use client";

import {
  BOOK_FORMATS,
  BookInput,
  GENRES,
  type AdminBook,
  type AiDraft,
  type BookFormat,
  suggestKrw,
} from "@sofiya/shared";
import { ImagePlus, Sparkles, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { BookCover } from "@/components/BookCover";
import { buttonClass, Notice } from "@/components/ui";
import { clientApi, clientUpload } from "@/lib/client-api";
import { FORMAT_LABELS, GENRE_LABELS, isDigital } from "@/lib/labels";
import { BookStatusTag, IndexBadge, Panel } from "./bits";

interface FormatRow {
  enabled: boolean;
  priceKrw: string; // won, as typed
  price: string; // dollars, as typed
  stock: string;
}

const input =
  "mt-1.5 block h-11 w-full rounded-[10px] border border-line bg-white px-3 text-[15px] outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";
const label = "block text-sm font-semibold";

function initialFormats(book?: AdminBook): Record<BookFormat, FormatRow> {
  return Object.fromEntries(
    BOOK_FORMATS.map((f) => {
      const existing = book?.formats.find((x) => x.format === f);
      return [
        f,
        existing
          ? {
              enabled: true,
              priceKrw: String(existing.price.KRW),
              price: (existing.price.USD / 100).toFixed(2),
              stock: existing.stock === null ? "" : String(existing.stock),
            }
          : { enabled: !book && (f === "PAPERBACK" || f === "EBOOK"), priceKrw: "", price: "", stock: isDigital(f) ? "" : "0" },
      ];
    }),
  ) as Record<BookFormat, FormatRow>;
}

export function BookEditor({ book, aiEnabled }: { book?: AdminBook; aiEnabled: boolean }) {
  const router = useRouter();
  const [title, setTitle] = useState(book?.title ?? "");
  const [author, setAuthor] = useState(book?.author ?? "");
  const [genre, setGenre] = useState(book?.genre ?? "FICTION");
  const [description, setDescription] = useState(book?.description ?? "");
  const [pages, setPages] = useState(book?.pages?.toString() ?? "");
  const [year, setYear] = useState(book?.publishedYear?.toString() ?? "");
  const [language, setLanguage] = useState(book?.language ?? "English");
  const [status, setStatus] = useState<"DRAFT" | "LIVE" | "PAUSED">(book && book.status !== "DELETED" ? book.status : "DRAFT");
  const [staffPick, setStaffPick] = useState(book?.staffPickNote ?? "");
  const [formats, setFormats] = useState(() => initialFormats(book));
  const [coverUrl, setCoverUrl] = useState(book?.coverUrl ?? null);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad" | "accent"; text: string } | null>(null);
  const [coverBusy, setCoverBusy] = useState(false);
  const [notes, setNotes] = useState("");
  const [draftCover, setDraftCover] = useState<File | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [beforeDraft, setBeforeDraft] = useState<{ description: string; genre: typeof genre; pages: string; year: string } | null>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  const setFormat = (f: BookFormat, patch: Partial<FormatRow>) => setFormats((all) => ({ ...all, [f]: { ...all[f], ...patch } }));

  function buildInput(): BookInput {
    return {
      title,
      author,
      genre,
      description,
      pages: pages ? Number(pages) : null,
      publishedYear: year ? Number(year) : null,
      language,
      status,
      staffPickNote: staffPick || null,
      formats: BOOK_FORMATS.filter((f) => formats[f].enabled).map((f) => ({
        format: f,
        price: {
          KRW: formats[f].priceKrw.trim() === "" ? NaN : Number(formats[f].priceKrw),
          USD: formats[f].price.trim() === "" ? NaN : Math.round(Number(formats[f].price) * 100),
        },
        stock: isDigital(f) ? null : Number(formats[f].stock || 0),
      })),
    };
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const body = buildInput();
    const invalidPrice = body.formats.find(
      (f) => !Number.isInteger(f.price.KRW) || f.price.KRW < 0 || !Number.isFinite(f.price.USD) || f.price.USD < 0,
    );
    if (invalidPrice) {
      setMessage({
        tone: "bad",
        text: `Enter both prices (whole won and dollars) for the ${FORMAT_LABELS[invalidPrice.format].toLowerCase()} edition.`,
      });
      return;
    }
    const parsed = BookInput.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setMessage({ tone: "bad", text: `${issue.path.join(" ") || "Form"}: ${issue.message}` });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const saved = book
        ? await clientApi<AdminBook>(`/admin/books/${book.id}`, { method: "PUT", body })
        : await clientApi<AdminBook>("/admin/books", { method: "POST", body });
      if (!book) {
        router.replace(`/admin/books/${saved.id}?created=1`);
        return;
      }
      setMessage({ tone: "ok", text: status === "LIVE" ? "Saved. The shop shows the changes now; the AI index updates in the background." : "Saved." });
      setBeforeDraft(null);
      router.refresh();
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Could not save." });
    } finally {
      setSaving(false);
    }
  }

  async function uploadCover(file: File) {
    if (!book) return;
    setCoverBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("cover", file);
      const saved = await clientUpload<AdminBook>(`/admin/books/${book.id}/cover`, form, "PUT");
      setCoverUrl(saved.coverUrl);
      setMessage({ tone: "ok", text: "Cover updated." });
      router.refresh();
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setCoverBusy(false);
      if (coverInput.current) coverInput.current.value = "";
    }
  }

  async function removeCover() {
    if (!book) return;
    setCoverBusy(true);
    try {
      await clientApi(`/admin/books/${book.id}/cover`, { method: "DELETE" });
      setCoverUrl(null);
      router.refresh();
    } finally {
      setCoverBusy(false);
    }
  }

  async function draftWithAi() {
    if (!title.trim() || !author.trim()) {
      setMessage({ tone: "bad", text: "Enter the title and author first." });
      return;
    }
    setDrafting(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("author", author);
      if (notes.trim()) form.append("notes", notes);
      if (draftCover) form.append("cover", draftCover);
      const draft = await clientUpload<AiDraft>("/admin/books/ai-draft", form);
      setBeforeDraft({ description, genre, pages, year });
      setDescription(draft.description);
      setGenre(draft.genre);
      if (draft.pages) setPages(String(draft.pages));
      if (draft.publishedYear !== null) setYear(String(draft.publishedYear));
      setMessage({ tone: "accent", text: "AI draft filled in below. Check every detail before saving: nothing has been saved yet." });
    } catch (err) {
      setMessage({ tone: "bad", text: err instanceof Error ? err.message : "The AI could not write a draft." });
    } finally {
      setDrafting(false);
    }
  }

  function undoDraft() {
    if (!beforeDraft) return;
    setDescription(beforeDraft.description);
    setGenre(beforeDraft.genre);
    setPages(beforeDraft.pages);
    setYear(beforeDraft.year);
    setBeforeDraft(null);
    setMessage(null);
  }

  async function remove() {
    if (!book || !confirm(`Delete “${book.title}”? It disappears from the shop; past orders keep their history.`)) return;
    await clientApi(`/admin/books/${book.id}`, { method: "DELETE" });
    router.push("/admin/books");
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-6">
        {/* On narrower screens the Publish panel sits below the whole form,
            so status and Save are repeated here. */}
        <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-line bg-white p-3 xl:hidden">
          <label className="flex items-center gap-2 text-sm font-semibold">
            Status
            <select
              className="h-10 rounded-[10px] border border-line bg-white px-3 text-[15px] font-medium outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="DRAFT">Draft (hidden)</option>
              <option value="LIVE">Live (in the shop)</option>
              <option value="PAUSED">Paused (hidden)</option>
            </select>
          </label>
          <button type="submit" disabled={saving} className={`${buttonClass.primary} ml-auto h-10`}>
            {saving ? "Saving…" : book ? "Save changes" : "Create book"}
          </button>
        </div>
        {message && <Notice tone={message.tone}>{message.text}</Notice>}

        <Panel title="Details">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <label className={`${label} sm:col-span-2`}>
              Title
              <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
            </label>
            <label className={label}>
              Author
              <input className={input} value={author} onChange={(e) => setAuthor(e.target.value)} required maxLength={200} />
            </label>
            <label className={label}>
              Genre
              <select className={input} value={genre} onChange={(e) => setGenre(e.target.value as typeof genre)}>
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {GENRE_LABELS[g]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>
              Description
              <textarea
                className={`${input} h-auto min-h-[130px] py-2.5 leading-relaxed`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={20}
                maxLength={4000}
              />
              <span className="mt-1 block font-normal text-ink-3">{description.length} / 4000 · used by search and Ask Sofiya</span>
            </label>
            <label className={label}>
              Pages
              <input className={input} type="number" min={1} value={pages} onChange={(e) => setPages(e.target.value)} />
            </label>
            <label className={label}>
              First published (negative for BC)
              <input className={input} type="number" value={year} onChange={(e) => setYear(e.target.value)} />
            </label>
            <label className={label}>
              Language
              <input className={input} value={language} onChange={(e) => setLanguage(e.target.value)} maxLength={40} />
            </label>
            <label className={label}>
              Staff-pick note <span className="font-normal text-ink-3">(optional)</span>
              <input className={input} value={staffPick} onChange={(e) => setStaffPick(e.target.value)} maxLength={200} placeholder="Shown in the homepage carousel" />
            </label>
          </div>
        </Panel>

        <Panel title="Formats, prices and stock">
          <div className="divide-y divide-line">
            {BOOK_FORMATS.map((f) => {
              const row = formats[f];
              return (
                <div key={f} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <label className="flex w-36 items-center gap-2.5 font-semibold">
                    <input type="checkbox" checked={row.enabled} onChange={(e) => setFormat(f, { enabled: e.target.checked })} className="size-4 accent-[var(--accent)]" />
                    {FORMAT_LABELS[f]}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    ₩
                    <input
                      type="number"
                      step="100"
                      min="0"
                      disabled={!row.enabled}
                      value={row.priceKrw}
                      onChange={(e) => setFormat(f, { priceKrw: e.target.value })}
                      className="h-10 w-28 rounded-[9px] border border-line px-2.5 text-[15px] disabled:bg-surface"
                      aria-label={`${FORMAT_LABELS[f]} price in won`}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink-2">
                    $
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      disabled={!row.enabled}
                      value={row.price}
                      onChange={(e) => setFormat(f, { price: e.target.value })}
                      className="h-10 w-28 rounded-[9px] border border-line px-2.5 text-[15px] disabled:bg-surface"
                      aria-label={`${FORMAT_LABELS[f]} price in dollars`}
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!row.enabled || !(Number(row.price) > 0)}
                    onClick={() => setFormat(f, { priceKrw: String(suggestKrw(Math.round(Number(row.price) * 100))) })}
                    className="text-sm font-semibold text-accent hover:text-accent-ink disabled:text-ink-3 disabled:opacity-60"
                    title="Suggest a round won price from the dollar price"
                  >
                    ₩ from $
                  </button>
                  {isDigital(f) ? (
                    <span className="text-sm text-ink-3">Digital: never runs out</span>
                  ) : (
                    <label className="flex items-center gap-2 text-sm text-ink-2">
                      Stock
                      <input
                        type="number"
                        min="0"
                        disabled={!row.enabled}
                        value={row.stock}
                        onChange={(e) => setFormat(f, { stock: e.target.value })}
                        className="h-10 w-24 rounded-[9px] border border-line px-2.5 text-[15px] disabled:bg-surface"
                        aria-label={`${FORMAT_LABELS[f]} stock`}
                      />
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      </div>

      <div className="space-y-6 xl:sticky xl:top-6">
        <Panel title="Publish">
          <div className="space-y-4 p-5">
            <label className={label}>
              Status
              <select className={input} value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="DRAFT">Draft (hidden)</option>
                <option value="LIVE">Live (in the shop)</option>
                <option value="PAUSED">Paused (hidden, keeps orders)</option>
              </select>
            </label>
            {book && (
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <BookStatusTag status={book.status} />
                <IndexBadge status={book.indexStatus} />
                {book.status === "LIVE" && (
                  <Link href={`/books/${book.slug}`} className="font-semibold text-accent" target="_blank">
                    View in shop ↗
                  </Link>
                )}
              </div>
            )}
            <button type="submit" disabled={saving} className={`${buttonClass.primary} w-full`}>
              {saving ? "Saving…" : book ? "Save changes" : "Create book"}
            </button>
            {book && (
              <button type="button" onClick={remove} className="flex w-full items-center justify-center gap-2 text-sm font-semibold text-bad">
                <Trash2 size={15} aria-hidden /> Delete book
              </button>
            )}
          </div>
        </Panel>

        <Panel title="Cover">
          <div className="space-y-3 p-5">
            <div className="mx-auto w-40">
              <BookCover slug={book?.slug ?? (title || "new")} title={title || "Untitled"} author={author || "Author"} coverUrl={coverUrl} />
            </div>
            {book ? (
              <div className="flex flex-wrap justify-center gap-2">
                <input
                  ref={coverInput}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  id="cover-file"
                  onChange={(e) => e.target.files?.[0] && void uploadCover(e.target.files[0])}
                />
                <label htmlFor="cover-file" className={`${buttonClass.outline} h-10 cursor-pointer`}>
                  <ImagePlus size={16} aria-hidden /> {coverBusy ? "Uploading…" : coverUrl ? "Replace" : "Upload cover"}
                </label>
                {coverUrl && (
                  <button type="button" onClick={removeCover} disabled={coverBusy} className={`${buttonClass.outline} h-10`}>
                    Remove
                  </button>
                )}
              </div>
            ) : (
              <p className="text-center text-sm text-ink-3">Create the book first, then upload its cover.</p>
            )}
            <p className="text-center text-xs text-ink-3">JPEG, PNG or WebP up to 5 MB. Resized and converted to WebP.</p>
          </div>
        </Panel>

        <Panel title="Draft with AI">
          <div className="space-y-3 p-5">
            {aiEnabled ? (
              <>
                <p className="text-sm text-ink-2">Gemini writes a description and suggests the genre, length and year from the title, author, an optional cover photo and your notes.</p>
                <label className={label}>
                  Notes <span className="font-normal text-ink-3">(optional)</span>
                  <textarea
                    className={`${input} h-auto min-h-[70px] py-2`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    maxLength={1000}
                    placeholder="e.g. new translation, illustrated edition"
                  />
                </label>
                <label className={label}>
                  Cover photo <span className="font-normal text-ink-3">(optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => setDraftCover(e.target.files?.[0] ?? null)}
                    className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-[8px] file:border-0 file:bg-surface file:px-3 file:py-2 file:font-semibold"
                  />
                </label>
                <button type="button" onClick={draftWithAi} disabled={drafting} className={`${buttonClass.dark} h-10 w-full`}>
                  <Sparkles size={16} aria-hidden /> {drafting ? "Writing…" : "Draft with AI"}
                </button>
                {beforeDraft && (
                  <button type="button" onClick={undoDraft} className="flex w-full items-center justify-center gap-1.5 text-sm font-semibold text-ink-2">
                    <Undo2 size={15} aria-hidden /> Undo the AI draft
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-3">Add GEMINI_API_KEY to apps/api/.env to enable AI drafts.</p>
            )}
          </div>
        </Panel>
      </div>
    </form>
  );
}
