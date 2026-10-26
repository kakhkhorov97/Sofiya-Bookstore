import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { BasketProvider } from "@/basket/BasketProvider";
import { CurrencyProvider } from "@/currency/CurrencyProvider";
import { getCurrency } from "@/currency/server";
import { getCurrentUser } from "@/lib/session";
import { WishlistProvider } from "@/wishlist/WishlistProvider";
import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Figtree({
  variable: "--font-body",
  subsets: ["latin"],
});

// Every page shows the signed-in user and live catalogue data.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Sofiya Bookstore", template: "%s · Sofiya" },
  description: "Classics, stories and programming books. Browse, search, ask our AI concierge and order from Sofiya.",
};

// Shop pages live in app/(store) with the header and footer; the admin in
// app/admin has its own layout.
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const [user, currency] = await Promise.all([getCurrentUser(), getCurrency()]);
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} flex min-h-screen flex-col antialiased`}>
        <CurrencyProvider initial={currency}>
        <BasketProvider>
          <WishlistProvider signedIn={!!user}>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-white"
            >
              Skip to content
            </a>
            {children}
          </WishlistProvider>
        </BasketProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
