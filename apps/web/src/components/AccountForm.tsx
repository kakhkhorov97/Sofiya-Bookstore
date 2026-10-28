"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { buttonClass, Notice } from "./ui";

const inputClass =
  "mt-1.5 block h-12 w-full rounded-[10px] border border-line px-3.5 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft";

export function AccountForm({ displayName }: { displayName: string }) {
  const router = useRouter();
  const t = useTranslations("account");
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const name = new FormData(e.currentTarget).get("displayName");
    setBusy(true);
    setStatus(null);
    try {
      await clientApi("/me", { method: "PATCH", body: { displayName: name } });
      setStatus({ tone: "ok", text: t("saved") });
      router.refresh();
    } catch (err) {
      setStatus({ tone: "bad", text: err instanceof Error ? err.message : t("saveFailed") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-5 max-w-[420px] space-y-3">
      <label className="block text-sm font-semibold">
        {t("displayName")}
        <input name="displayName" defaultValue={displayName} required maxLength={60} className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={buttonClass.dark}>
        {busy ? t("saving") : t("saveChanges")}
      </button>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
    </form>
  );
}

// Needs the current password; other devices are signed out, this one stays in.
export function ChangePasswordForm() {
  const t = useTranslations("account");
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const newPassword = String(form.get("newPassword") ?? "");
    if (newPassword !== String(form.get("repeat") ?? "")) {
      setStatus({ tone: "bad", text: t("mismatch") });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await clientApi("/me/password", {
        method: "PATCH",
        body: { currentPassword: form.get("currentPassword"), newPassword },
      });
      formEl.reset();
      setStatus({ tone: "ok", text: t("changed") });
    } catch (err) {
      setStatus({
        tone: "bad",
        text: err instanceof ClientApiError || err instanceof Error ? err.message : t("changeFailed"),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 max-w-[420px] space-y-3">
      <label className="block text-sm font-semibold">
        {t("current")}
        <input name="currentPassword" type="password" required maxLength={128} autoComplete="current-password" className={inputClass} />
      </label>
      <label className="block text-sm font-semibold">
        {t("new")}
        <input name="newPassword" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
        <span className="mt-1.5 block font-normal text-ink-3">{t("newHint")}</span>
      </label>
      <label className="block text-sm font-semibold">
        {t("repeat")}
        <input name="repeat" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} />
      </label>
      <button type="submit" disabled={busy} className={buttonClass.dark}>
        {busy ? t("changing") : t("change")}
      </button>
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <p className="text-sm text-ink-3">
        {t.rich("noPassword", {
          link: (c) => (
            <Link href="/forgot-password" className="font-semibold text-accent underline underline-offset-2">
              {c}
            </Link>
          ),
        })}
      </p>
    </form>
  );
}
