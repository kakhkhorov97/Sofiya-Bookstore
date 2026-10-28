import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { GoogleButton, OrDivider } from "@/components/GoogleButton";
import { Notice } from "@/components/ui";
import { getAuthProviders } from "@/lib/providers";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

const GOOGLE_ERRORS: Record<string, string> = {
  cancelled: "Google sign-in was cancelled.",
  expired: "That Google sign-in took too long or came from another window. Please try again.",
  unverified: "Google hasn't verified the email on that account, so we can't use it. Verify it with Google, or sign up with email.",
  closed: "This account has been closed or blocked. Please contact the store.",
  failed: "Google sign-in didn't work. Please try again, or use email.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string; google?: string }>;
}) {
  const { next, reset, google } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/account"));
  const providers = await getAuthProviders();
  const googleError = google ? GOOGLE_ERRORS[google] ?? GOOGLE_ERRORS.failed : null;

  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Sign in</h1>
      <p className="mt-2 text-ink-2">Welcome back. Sign in to check out and track your orders.</p>
      {googleError && (
        <div className="mt-6">
          <Notice tone={google === "cancelled" ? "warn" : "bad"}>{googleError}</Notice>
        </div>
      )}
      {providers.google && (
        <div className="mt-8">
          <GoogleButton next={safeNext(next, "/")} />
          <OrDivider />
        </div>
      )}
      {reset === "1" && (
        <div className="mt-6">
          <Notice tone="ok">Your password has been changed. Sign in with the new one.</Notice>
        </div>
      )}
      <Suspense>
        <AuthForm mode="signin" />
      </Suspense>
    </div>
  );
}
