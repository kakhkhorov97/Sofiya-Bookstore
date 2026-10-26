import Link from "next/link";
import { FreeDeliveryNote } from "@/currency/CurrencySwitcher";
import { GENRE_LABELS } from "@/lib/labels";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line bg-surface">
      <div className="mx-auto grid w-[min(1240px,calc(100%-32px))] grid-cols-2 gap-8 py-12 text-[15px] text-ink-2 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="col-span-2 md:col-span-1">
          <p className="font-bold text-ink">Sofiya Bookstore</p>
          <p className="mt-2 max-w-[36ch]">Classics, stories and programming books, delivered. <FreeDeliveryNote />.</p>
        </div>
        <FooterList
          title="Shop"
          links={[
            ["/books", "All books"],
            ["/books?genre=MYSTERY", GENRE_LABELS.MYSTERY],
            ["/books?genre=PROGRAMMING", GENRE_LABELS.PROGRAMMING],
          ]}
        />
        <FooterList
          title="Account"
          links={[
            ["/account", "Your account"],
            ["/orders", "Orders"],
            ["/basket", "Basket"],
          ]}
        />
        <FooterList
          title="Formats"
          links={[
            ["/books?format=HARDCOVER", "Hardcover"],
            ["/books?format=EBOOK", "Ebook"],
            ["/books?format=AUDIOBOOK", "Audiobook"],
          ]}
        />
        <p className="col-span-2 border-t border-line pt-5 text-[13px] text-ink-3 md:col-span-4">
          A portfolio project. The catalogue lists real public-domain and freely licensed books; prices, stock and orders
          are demo data and no payment is taken.
        </p>
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
