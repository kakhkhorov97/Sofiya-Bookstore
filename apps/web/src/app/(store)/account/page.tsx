import { Heart, MessageSquareText, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { AccountForm, ChangePasswordForm } from "@/components/AccountForm";
import { SignOutButton } from "@/components/SignOutButton";
import { Container, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("account"))("title") };
}
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser("/account");
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);

  return (
    <Container className="max-w-[720px]">
      <PageTitle sub={t("account.memberSince", { date: format.dateTime(new Date(user.createdAt), { dateStyle: "medium" }) })}>
        {t("account.hi", { name: user.displayName })}
      </PageTitle>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[14px] bg-accent-soft p-5">
          <p className="text-sm font-semibold text-accent-ink">{t("account.points")}</p>
          <p className="mt-1 font-display text-4xl font-extrabold text-accent-ink">{user.points}</p>
          <p className="mt-1 text-sm text-ink-2">{t("account.pointsText")}</p>
        </div>
        <Link href="/orders" className="rounded-[14px] border border-line p-5 hover:border-ink-3">
          <p className="text-sm font-semibold text-ink-3">{t("account.orders")}</p>
          <p className="mt-1 font-display text-2xl font-extrabold">{t("account.trackOrders")}</p>
          <p className="mt-1 text-sm text-ink-2">{t("account.trackText")}</p>
        </Link>
      </div>

      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/wishlist", icon: <Heart size={19} aria-hidden />, title: t("common.wishlist"), text: t("account.wishlistText") },
          { href: "/account/reviews", icon: <MessageSquareText size={19} aria-hidden />, title: t("account.reviews"), text: t("account.reviewsText") },
          { href: "/ask", icon: <Sparkles size={19} aria-hidden className="text-accent" />, title: t("common.askSofiya"), text: t("account.askText") },
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
        <h2 className="font-display text-2xl font-extrabold">{t("account.profile")}</h2>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-[15px]">
          <dt className="text-ink-3">{t("account.email")}</dt>
          <dd>{user.email}</dd>
        </dl>
        <AccountForm displayName={user.displayName} />
      </section>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-extrabold">{t("account.password")}</h2>
        <p className="mt-1 text-[15px] text-ink-3">{t("account.passwordText")}</p>
        <ChangePasswordForm />
      </section>

      <div className="mt-10 border-t border-line pt-6">
        <SignOutButton />
      </div>
    </Container>
  );
}
