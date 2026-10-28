"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { inputClass } from "./AuthForm";
import { buttonClass, Notice } from "./ui";

const errorText = (err: unknown) =>
  err instanceof ClientApiError && err.status === 429
    ? "Too many attempts. Please wait a minute and try again."
    : err instanceof Error
      ? err.message
      : "Something went wrong. Please try again.";

export function ForgotPasswordForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "");
    setBusy(true);
    setError(null);
    try {
      await clientApi("/auth/password/forgot", { method: "POST", body: { email } });
      setSentTo(email);
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="mt-8 rounded-[14px] bg-surface p-6" role="status">
        <MailCheck size={26} className="text-accent" aria-hidden />
        <p className="mt-3 font-semibold">Check your inbox</p>
        <p className="mt-1 text-[15px] text-ink-2">
          If <b>{sentTo}</b> has a Sofiya account, we’ve sent it a link to choose a new password. It works once, for 30
          minutes. Nothing there? Check your spam folder, or try again in a minute.
        </p>
        <Link href="/signin" className="mt-4 inline-block font-semibold text-accent">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {error && <Notice tone="bad">{error}</Notice>}
      <label className="block text-sm font-semibold">
        Email
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <p className="text-center text-[15px] text-ink-2">
        Remembered it?{" "}
        <Link href="/signin" className="font-semibold text-accent underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords don’t match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi("/auth/password/reset", { method: "POST", body: { token, password } });
      // The reset ended every session: reload fully so nothing signed-in remains.
      window.location.replace("/signin?reset=1");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {error && (
        <Notice tone="bad">
          {error}{" "}
          {/expired|invalid/i.test(error) && (
            <Link href="/forgot-password" className="font-semibold underline">
              Get a new link
            </Link>
          )}
        </Notice>
      )}
      <label className="block text-sm font-semibold">
        New password
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <span className="mt-1.5 block font-normal text-ink-3">At least 8 characters.</span>
      </label>
      <label className="block text-sm font-semibold">
        Repeat the new password
        <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? "Saving…" : "Set new password"}
      </button>
      <p className="text-sm text-ink-3">This signs you out everywhere else.</p>
    </form>
  );
}
