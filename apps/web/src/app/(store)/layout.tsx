import type { GenreCount, PaymentConfig } from "@sofiya/shared";
import { AskLauncher } from "@/components/AskLauncher";
import { ConfirmEmailBanner } from "@/components/EmailConfirmation";
import { Footer } from "@/components/Footer";
import { Header, PromoBar } from "@/components/Header";
import { apiGet } from "@/lib/api";
import { getCurrentUser } from "@/lib/session";

export default async function StoreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, genres, payments] = await Promise.all([
    getCurrentUser(),
    apiGet<GenreCount[]>("/genres", { revalidate: 300 }).catch(() => [] as GenreCount[]),
    apiGet<PaymentConfig>("/payments/config", { revalidate: 300 }).catch(() => null),
  ]);
  return (
    <>
      <PromoBar />
      <Header user={user} genres={genres} />
      {user && !user.emailVerified && <ConfirmEmailBanner email={user.email} />}
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer paymentsTestMode={payments?.card.testMode ?? true} />
      <AskLauncher />
    </>
  );
}
