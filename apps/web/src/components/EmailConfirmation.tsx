"use client";

import { CheckCircle2, LoaderCircle, MailWarning } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { ButtonLink, Container, Notice } from "./ui";

// Opened from the "Confirm your email" message.
export function ConfirmEmail({ token }: { token: string }) {
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
        setState({ error: err instanceof Error ? err.message : "This link could not be confirmed." }),
      );
  }, [token, router]);

  if (state === "working") {
    return (
      <p className="mt-8 flex items-center gap-3 text-ink-2" role="status">
        <LoaderCircle size={20} className="animate-spin text-accent" aria-hidden /> Confirming your email…
      </p>
    );
  }
  if (state === "done") {
    return (
      <div className="mt-8 space-y-4">
        <Notice tone="ok">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={18} aria-hidden /> Your email is confirmed. You can now order and write reviews.
          </span>
        </Notice>
        <ButtonLink href="/books">Browse books</ButtonLink>
      </div>
    );
  }
  return (
    <div className="mt-8 space-y-4">
      <Notice tone="bad">{state.error}</Notice>
      <p className="text-ink-2">
        Signed in? Use <b>Resend email</b> in the banner at the top of the page to get a new link.
      </p>
    </div>
  );
}

// Shown on every shop page until the address is confirmed.
export function ConfirmEmailBanner({ email }: { email: string }) {
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
            ? "Please wait a minute before asking again."
            : err instanceof Error
              ? err.message
              : "Could not send the email.",
      });
    }
  }

  return (
    <div className="border-b border-[#f1dfb0] bg-warn-soft text-[#7a5300]" role="status">
      <Container className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-sm">
        <MailWarning size={17} className="shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <b>Confirm your email</b> to order and write reviews. We sent a link to <b>{email}</b>.
        </span>
        {status === "sent" ? (
          <span className="font-semibold">Sent. Check your inbox (and spam).</span>
        ) : (
          <button
            type="button"
            onClick={resend}
            disabled={status === "sending"}
            className="font-semibold underline underline-offset-2 disabled:opacity-60"
          >
            {status === "sending" ? "Sending…" : "Resend email"}
          </button>
        )}
        {typeof status === "object" && <span className="basis-full font-medium text-bad">{status.error}</span>}
      </Container>
    </div>
  );
}

// Checkout and reviews explain the step instead of failing.
export function ConfirmEmailNotice({ action }: { action: string }) {
  return (
    <div className="mt-8 rounded-[16px] bg-warn-soft px-6 py-8 text-[#7a5300]">
      <p className="font-display text-xl font-extrabold">Confirm your email to {action}</p>
      <p className="mt-2 text-[15px]">
        We sent you a link when you signed up. Use <b>Resend email</b> in the yellow banner above if you can’t find it.
      </p>
      <Link href="/basket" className="mt-4 inline-block font-semibold underline">
        Back to basket
      </Link>
    </div>
  );
}
