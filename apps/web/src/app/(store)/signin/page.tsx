import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { Notice } from "@/components/ui";
import { getAuthProviders } from "@/lib/providers";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("auth"))("signInTitle") };
}

const GOOGLE_ERRORS = ["cancelled", "expired", "unverified", "closed", "failed"] as const;

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; google?: string }>;
}) {
  const { next, reset, google } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/account"));
  const [providers, t] = await Promise.all([getAuthProviders(), getTranslations("auth")]);
  const googleError = google
    ? t(`googleErrors.${(GOOGLE_ERRORS as readonly string[]).includes(google) ? (google as (typeof GOOGLE_ERRORS)[number]) : "failed"}`)
    : null;

  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">{t("signInTitle")}</h1>
      <p className="mt-2 text-ink-2">{t("signInIntro")}</p>
      {googleError && (
        <div className="mt-6">
          <Notice tone={google === "cancelled" ? "warn" : "bad"}>{googleError}</Notice>
        </div>
      )}
      {reset === "1" && (
        <div className="mt-6">
          <Notice tone="ok">{t("passwordChanged")}</Notice>
        </div>
      )}
      <Suspense>
        <AuthForm
          mode="signin"
          alternative={
            providers.google && (
              <>
                <OrDivider />
                <GoogleButton next={safeNext(next, "/")} />
              </>
            )
          }
        />
      </Suspense>
    </div>
  );
}
