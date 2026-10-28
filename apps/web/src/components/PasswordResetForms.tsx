"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { inputClass } from "./AuthForm";
import { buttonClass, Notice } from "./ui";

const isStatus = (err: unknown, status: number) => err instanceof ClientApiError && err.status === status;

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
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
      // 503 means email is switched off; its message says what to do.
      setError(isStatus(err, 429) ? t("tooMany") : isStatus(err, 503) && err instanceof Error ? err.message : t("generic"));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <div className="mt-8 rounded-[14px] bg-surface p-6" role="status">
        <MailCheck size={26} className="text-accent" aria-hidden />
        <p className="mt-3 font-semibold">{t("checkInbox")}</p>
        <p className="mt-1 text-[15px] text-ink-2">{t.rich("sentText", { b: (c) => <b>{c}</b>, email: sentTo })}</p>
        <Link href="/signin" className="mt-4 inline-block font-semibold text-accent">
          {t("backToSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {error && <Notice tone="bad">{error}</Notice>}
      <label className="block text-sm font-semibold">
        {t("email")}
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? t("sending") : t("sendLink")}
      </button>
      <p className="text-center text-[15px] text-ink-2">
        {t("remembered")}{" "}
        <Link href="/signin" className="font-semibold text-accent underline underline-offset-2">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [error, setError] = useState<{ text: string; newLink: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password !== String(form.get("confirm") ?? "")) {
      setError({ text: t("mismatch"), newLink: false });
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi("/auth/password/reset", { method: "POST", body: { token, password } });
      // The reset ended every session: reload fully so nothing signed-in remains.
      window.location.replace("/signin?reset=1");
    } catch (err) {
      // 400 here means the link is used up or expired.
      setError(
        isStatus(err, 400)
          ? { text: t("linkExpired"), newLink: true }
          : { text: isStatus(err, 429) ? t("tooMany") : t("generic"), newLink: false },
      );
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-8 space-y-5">
      {error && (
        <Notice tone="bad">
          {error.text}{" "}
          {error.newLink && (
            <Link href="/forgot-password" className="font-semibold underline">
              {t("getNewLink")}
            </Link>
          )}
        </Notice>
      )}
      <label className="block text-sm font-semibold">
        {t("newPassword")}
        <input name="password" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <span className="mt-1.5 block font-normal text-ink-3">{t("atLeast8")}</span>
      </label>
      <label className="block text-sm font-semibold">
        {t("repeatPassword")}
        <input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? t("saving") : t("setPassword")}
      </button>
      <p className="text-sm text-ink-3">{t("signsOutElsewhere")}</p>
    </form>
  );
}
