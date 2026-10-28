import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { getAuthProviders } from "@/lib/providers";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signUpTitle") };
}

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/account"));
  const [providers, t] = await Promise.all([getAuthProviders(), getTranslations("auth")]);

  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("signUpTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("signUpIntro")}</p>
      {providers.google && (
        <div className="mt-8">
          <GoogleButton next={safeNext(next, "/")} />
          <OrDivider />
        </div>
      )}
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
