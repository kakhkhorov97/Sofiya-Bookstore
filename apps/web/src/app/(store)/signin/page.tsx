import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { Notice } from "@/components/ui";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; reset?: string }>;
}) {
  const { next, reset } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/account"));

  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Sign in</h1>
      <p className="mt-2 text-ink-2">Welcome back. Sign in to check out and track your orders.</p>
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
