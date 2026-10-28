import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ButtonLink, Container } from "@/components/ui";

export default async function NotFound() {
  const t = await getTranslations("errors");
  return (
    <main id="main" className="flex-1">
      <div className="border-b border-line">
        <Container className="flex h-16 items-center">
          <Link href="/" className="font-display text-[26px] font-extrabold tracking-[-0.03em]">
            Sofiya<span className="text-accent">.</span>
          </Link>
        </Container>
      </div>
      <Container className="py-20 text-center">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em]">{t("notFoundTitle")}</h1>
        <p className="mt-3 text-ink-2">{t("notFoundText")}</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/books">{t("browse")}</ButtonLink>
          <ButtonLink href="/" variant="outline">
            {t("home")}
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
