import type { AiStatus } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { BookEditor } from "@/components/admin/BookEditor";
import { AdminTitle } from "@/components/admin/bits";
import { apiGet } from "@/lib/api";

export const metadata: Metadata = { title: "Add book" };

export default async function NewBookPage() {
  const ai = await apiGet<AiStatus>("/ai/status").catch(() => ({ enabled: false, indexedBooks: 0 }));
  return (
    <div className="space-y-5">
      <p className="text-sm">
        <Link href="/admin/books" className="text-ink-3 hover:text-ink">
          ← Books
        </Link>
      </p>
      <AdminTitle sub="New books start as drafts. Set the status to Live when they are ready.">Add a book</AdminTitle>
      <BookEditor aiEnabled={ai.enabled} />
    </div>
  );
}
