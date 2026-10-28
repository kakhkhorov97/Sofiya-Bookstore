"use client";

import { useTranslations } from "next-intl";
import { buttonClass, Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  const t = useTranslations("errors");
  return (
    <Container className="py-20 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("title")}</h1>
      <p className="mx-auto mt-3 max-w-[44ch] text-ink-2">
        {t("text")}
      </p>
      <button type="button" onClick={reset} className={`${buttonClass.primary} mt-8`}>
        {t("retry")}
      </button>
    </Container>
  );
}
