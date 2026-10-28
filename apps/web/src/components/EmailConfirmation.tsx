"use client";

import { CheckCircle2, LoaderCircle, MailWarning } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { ButtonLink, Container, Notice } from "./ui";

// Opened from the "Confirm your email" message.
export function ConfirmEmail({ token }: { token: string }) {
  const t = useTranslations("emailConfirm");
  const router = useRouter();
  const [state, setState] = useState<"working" | "done" | { error: string }>("working");
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    clientApi("/auth/email/confirm", { method: "POST", body: { token } })
      .then(() => {
        setState("done");
        router.refresh(); // the banner disappears if this browser is signed in
      })
      .catch((err: unknown) =>
        setState({ error: err instanceof Error ? err.message : t("failed") }),
      );
  }, [token, router, t]);

  if (state === "working") {
    return (
      <p className="mt-8 flex items-center gap-3 text-ink-2" role="status">
        <LoaderCircle size={20} className="animate-spin text-accent" aria-hidden /> {t("working")}
      </p>
    );
  }
  if (state === "done") {
    return (
      <div className="mt-8 space-y-4">
        <Notice tone="ok">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} aria-hidden /> {t("done")}
          </span>
        </Notice>
        <ButtonLink href="/books">{t("browse")}</ButtonLink>
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-4">
      <Notice tone="bad">{state.error}</Notice>
      <p className="text-ink-2">
        {t.rich("useResend", { b: (c) => <b>{c}</b> })}
      </p>
    </div>
  );
}

// Shown on every shop page until the address is confirmed.
export function ConfirmEmailBanner({ email }: { email: string }) {
  const t = useTranslations("emailConfirm");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | { error: string }>("idle");

  async function resend() {
    setStatus("sending");
    try {
      await clientApi("/auth/email/resend", { method: "POST" });
      setStatus("sent");
    } catch (err) {
      setStatus({
        error:
          err instanceof ClientApiError && err.status === 429
            ? t("waitMinute")
            : err instanceof Error
              ? err.message
              : t("sendFailed"),
      });
    }
  }

  return (
    <div className="border-b border-[#f1dfb0] bg-warn-soft text-[#7a5300]" role="status">
      <Container className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
        <MailWarning size={17} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          {t.rich("banner", { b: (c) => <b>{c}</b>, email })}
        </span>
        {status === "sent" ? (
          <span className="font-semibold">{t("sent")}</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="font-semibold underline underline-offset-2 disabled:opacity-60"
          >
            {status === "sending" ? t("sending") : t("resend")}
          </button>
        )}
        {typeof status === "object" && <span className="basis-full font-medium text-bad">{status.error}</span>}
      </Container>
    </div>
  );
}

// Checkout and reviews explain the step instead of failing.
export function ConfirmEmailNotice() {
  const t = useTranslations("emailConfirm");
  return (
    <div className="mt-8 rounded-[16px] bg-warn-soft px-6 py-8 text-[#7a5300]">
      <p className="font-display text-xl font-extrabold">{t("noticeTitle")}</p>
      <p className="mt-2 text-[15px]">
        {t.rich("noticeText", { b: (c) => <b>{c}</b> })}
      </p>
      <Link href="/basket" className="mt-4 inline-block font-semibold underline">
        {t("backToBasket")}
      </Link>
    </div>
  );
}
