import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ResetPasswordForm } from "@/components/PasswordResetForms";
import { Notice } from "@/components/ui";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("resetTitle"), referrer: "no-referrer" };
}

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("resetTitle")}</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-8">
          <Notice tone="bad">
            {t("incompleteLink")}{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              {t("getNewLink")}
            </Link>
          </Notice>
        </div>
      )}
    </div>
  );
}
