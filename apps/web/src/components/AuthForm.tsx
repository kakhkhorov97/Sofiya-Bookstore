"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { safeNext } from "@/lib/safe-next";
import { buttonClass, Notice } from "./ui";

export const inputClass =
  "mt-1.5 block h-12 w-full rounded-[10px] border border-line bg-white px-3.5 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/auth/${mode}`, {
        method: "POST",
        body: signup
          ? { email: form.get("email"), password: form.get("password"), displayName: form.get("displayName") }
          : { email: form.get("email"), password: form.get("password") },
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ClientApiError && err.status === 429
          ? "Too many attempts. Please wait a minute and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
      setBusy(false);
    }
  }

  const otherHref = `${signup ? "/signin" : "/signup"}${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5" noValidate={false}>
      {error && <Notice tone="bad">{error}</Notice>}
      {signup && (
        <label className="block text-sm font-semibold">
          Your name
          <input name="displayName" required maxLength={60} autoComplete="name" className={inputClass} />
        </label>
      )}
      <label className="block text-sm font-semibold">
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        <span className="flex items-baseline justify-between">
          Password
          {!signup && (
            <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:text-accent-ink">
              Forgot password?
            </Link>
          )}
        </span>
        <input
          name="password"
          type="password"
          required
          minLength={signup ? 8 : 1}
          maxLength={128}
          autoComplete={signup ? "new-password" : "current-password"}
          className={inputClass}
        />
        {signup && <span className="mt-1.5 block font-normal text-ink-3">At least 8 characters.</span>}
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? "Please wait…" : signup ? "Create account" : "Sign in"}
      </button>
      <p className="text-center text-[15px] text-ink-2">
        {signup ? "Already have an account? " : "New to Sofiya? "}
        <Link href={otherHref} className="font-semibold text-accent underline underline-offset-2">
          {signup ? "Sign in" : "Create an account"}
        </Link>
      </p>
    </form>
  );
}
