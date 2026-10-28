import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("forgotPageTitle") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("forgotTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("forgotIntro")}</p>
      <ForgotPasswordForm />
    </div>
  );
}
