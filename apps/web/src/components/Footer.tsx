import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FreeDeliveryNote } from "@/currency/CurrencySwitcher";

export async function Footer({ paymentsTestMode = true }: { paymentsTestMode?: boolean }) {
  const t = await getTranslations();
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid w-[min(1240px,calc(100%-32px))] grid-cols-2 gap-8 py-12 text-[15px] text-ink-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <p className="font-bold text-ink">Sofiya Bookstore</p>
          <p className="mt-2 max-w-[36ch]">
            {t("footer.tagline")} <FreeDeliveryNote />.
          </p>
        </div>
        <FooterList
          title={t("footer.shop")}
          links={[
            ["/books", t("common.allBooks")],
            ["/books?genre=MYSTERY", t("labels.genre.MYSTERY")],
            ["/books?genre=PROGRAMMING", t("labels.genre.PROGRAMMING")],
          ]}
        />
        <FooterList
          title={t("footer.account")}
          links={[
            ["/account", t("footer.yourAccount")],
            ["/orders", t("common.orders")],
            ["/basket", t("common.basket")],
          ]}
        />
        <FooterList
          title={t("footer.formats")}
          links={[
            ["/books?format=HARDCOVER", t("labels.format.HARDCOVER")],
            ["/books?format=EBOOK", t("labels.format.EBOOK")],
            ["/books?format=AUDIOBOOK", t("labels.format.AUDIOBOOK")],
          ]}
        />
        <div className="col-span-2 flex flex-col gap-3 border-t border-line pt-5 text-[13px] text-ink-3 md:col-span-4 md:flex-row md:justify-between md:gap-10">
          <p className="max-w-[90ch]">
            {t("footer.about")}
            {paymentsTestMode && ` ${t("footer.testMode")}`}
          </p>
          <nav aria-label={t("legal.legal")} className="flex shrink-0 gap-4 font-semibold text-ink-2">
            <Link href="/privacy" className="hover:text-ink">
              {t("legal.privacy")}
            </Link>
            <Link href="/terms" className="hover:text-ink">
              {t("legal.terms")}
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-2 font-bold text-ink">{title}</p>
      <ul className="space-y-1.5">
        {links.map(([href, label]) => (
          <li key={href}>
            <Link href={href} className="hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
