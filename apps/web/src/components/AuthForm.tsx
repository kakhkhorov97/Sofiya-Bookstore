"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { safeNext } from "@/lib/safe-next";
import { buttonClass, Notice } from "./ui";

export const inputClass =
  "mt-1.5 block h-12 w-full rounded-[10px] border border-line bg-white px-3.5 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const t = useTranslations("auth");
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
      // Full page load so the header, the page and every cached view switch
      // to the signed-in reader together.
      window.location.assign(next);
    } catch (err) {
      setError(
        // The API's messages are English; these statuses have their own words.
        err instanceof ClientApiError && err.status === 429
          ? t("tooMany")
          : err instanceof ClientApiError && err.status === 401
            ? t("wrongCredentials")
            : err instanceof ClientApiError && err.status === 403
              ? t("blocked")
              : err instanceof ClientApiError && err.status === 409
                ? t("emailTaken")
                : err instanceof ClientApiError && err.status === 400
                  ? t("checkFields")
                  : t("generic"),
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
          {t("yourName")}
          <input name="displayName" required maxLength={60} autoComplete="name" className={inputClass} />
        </label>
      )}
      <label className="block text-sm font-semibold">
        {t("email")}
        <input name="email" type="email" required autoComplete="email" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        <span className="flex items-baseline justify-between">
          {t("password")}
          {!signup && (
            <Link href="/forgot-password" className="text-sm font-semibold text-accent hover:text-accent-ink">
              {t("forgot")}
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
        {signup && <span className="mt-1.5 block font-normal text-ink-3">{t("atLeast8")}</span>}
      </label>
      <button type="submit" disabled={busy} className={`${buttonClass.primary} w-full`}>
        {busy ? t("pleaseWait") : signup ? t("createAccount") : t("signIn")}
      </button>
      <p className="text-center text-[15px] text-ink-2">
        {signup ? t("haveAccount") : t("newHere")}{" "}
        <Link href={otherHref} className="font-semibold text-accent underline underline-offset-2">
          {signup ? t("signIn") : t("createAnAccount")}
        </Link>
      </p>
    </form>
  );
}
