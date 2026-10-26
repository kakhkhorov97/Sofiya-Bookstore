import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/session";
import { safeNext } from "@/lib/safe-next";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await getCurrentUser()) redirect(safeNext(next, "/account"));

  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Create an account</h1>
      <p className="mt-2 text-ink-2">You need an account to place orders, track them and earn points.</p>
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </div>
  );
}
