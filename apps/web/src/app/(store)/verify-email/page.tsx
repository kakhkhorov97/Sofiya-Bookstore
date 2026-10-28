import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ConfirmEmail } from "@/components/EmailConfirmation";
import { Notice } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("emailConfirm"))("pageTitle"), referrer: "no-referrer" };
}

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("emailConfirm");
  return (
    <div className="mx-auto w-[min(480px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("pageTitle")}</h1>
      {token ? (
        <ConfirmEmail token={token} />
      ) : (
        <div className="mt-8">
          <Notice tone="bad">
            {t("incomplete")}{" "}
            <Link href="/account" className="font-semibold underline">
              {t("goToAccount")}
            </Link>
          </Notice>
        </div>
      )}
    </div>
  );
}
