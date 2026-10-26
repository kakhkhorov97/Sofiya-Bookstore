import { Heart, MessageSquareText, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AccountForm } from "@/components/AccountForm";
import { SignOutButton } from "@/components/SignOutButton";
import { Container, PageTitle } from "@/components/ui";
import { dateLabel } from "@/lib/labels";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Your account" };
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");

  return (
    <Container className="max-w-[720px]">
      <PageTitle sub={`Member since ${dateLabel(user.createdAt)}`}>Hi, {user.displayName}</PageTitle>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] bg-accent-soft p-5">
          <p className="text-sm font-semibold text-accent-ink">Points</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-accent-ink">{user.points}</p>
          <p className="mt-1 text-sm text-ink-2">You earn a point when an order is confirmed.</p>
        </div>
        <Link href="/orders" className="rounded-[14px] border border-line p-5 hover:border-ink-3">
          <p className="text-sm font-semibold text-ink-3">Orders</p>
          <p className="mt-1 font-display text-2xl font-extrabold">Track your orders</p>
          <p className="mt-1 text-sm text-ink-2">See status, cancel unconfirmed orders.</p>
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/wishlist", icon: <Heart size={19} aria-hidden />, title: "Wishlist", text: "Books you saved for later" },
          { href: "/account/reviews", icon: <MessageSquareText size={19} aria-hidden />, title: "My reviews", text: "Write and edit reviews" },
          { href: "/ask", icon: <Sparkles size={19} aria-hidden className="text-accent" />, title: "Ask Sofiya", text: "Get AI book suggestions" },
        ].map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="flex h-full items-start gap-3 rounded-[14px] border border-line p-4 hover:border-ink-3">
              <span className="mt-0.5 text-ink-2">{l.icon}</span>
              <span>
                <span className="block font-semibold">{l.title}</span>
                <span className="block text-sm text-ink-3">{l.text}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-extrabold">Profile</h2>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-[15px]">
          <dt className="text-ink-3">Email</dt>
          <dd>{user.email}</dd>
        </dl>
        <AccountForm displayName={user.displayName} />
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <SignOutButton />
      </div>
    </Container>
  );
}
