import type { AdminBook, AiStatus } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookEditor } from "@/components/admin/BookEditor";
import { AdminTitle } from "@/components/admin/bits";
import { Notice } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";
import { dateLabel } from "@/lib/labels";

export const metadata: Metadata = { title: "Edit book" };

export default async function EditBookPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  const { id } = await params;
  const created = (await searchParams).created === "1";
  let book: AdminBook;
  try {
    book = await apiGet<AdminBook>(`/admin/books/${encodeURIComponent(id)}`, { auth: true });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const ai = await apiGet<AiStatus>("/ai/status").catch(() => ({ enabled: false, indexedBooks: 0 }));

  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/admin/books" className="text-ink-3 hover:text-ink">
          ← Books
        </Link>
      </p>
      <AdminTitle sub={`/${book.slug} · ${book.views} views · updated ${dateLabel(book.updatedAt)}`}>{book.title}</AdminTitle>
      {created && <Notice tone="ok">Book created. Add a cover, then set it to Live when it is ready.</Notice>}
      <BookEditor key={book.updatedAt} book={book} aiEnabled={ai.enabled} />
    </div>
  );
}
