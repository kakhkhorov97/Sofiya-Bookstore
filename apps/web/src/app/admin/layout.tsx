import type { AdminOverview } from "@sofiya/shared";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { apiGet } from "@/lib/api";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Sofiya admin" },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin("/admin");
  const overview = await apiGet<AdminOverview>("/admin/overview", { auth: true }).catch(() => null);

  return (
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      <aside className="border-b border-line bg-white px-4 py-4 lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:shrink-0 lg:border-b-0 lg:border-r lg:py-6">
        <div className="mb-4 flex items-center justify-between lg:mb-8 lg:block">
          <Link href="/admin" className="font-display text-[24px] font-extrabold tracking-[-0.03em]">
            Sofiya<span className="text-accent">.</span>
            <span className="ml-1.5 align-middle font-sans text-xs font-semibold text-ink-3">admin</span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent lg:hidden">
            View shop <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
        <AdminNav pendingOrders={overview?.orders.PAUSED ?? 0} />
        <div className="mt-8 hidden border-t border-line pt-5 text-sm lg:block">
          <p className="font-semibold">{admin.displayName}</p>
          <p className="truncate text-ink-3">{admin.email}</p>
          <Link href="/" className="mt-3 inline-flex items-center gap-1 font-semibold text-accent">
            View shop <ExternalLink size={14} aria-hidden />
          </Link>
        </div>
      </aside>
      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8">
        {children}
      </main>
    </div>
  );
}
