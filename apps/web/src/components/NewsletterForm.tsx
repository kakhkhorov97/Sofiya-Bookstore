"use client";

import { Check, Mail } from "lucide-react";
import { useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";

export function NewsletterForm() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = new FormData(e.currentTarget).get("email");
    setState("busy");
    try {
      await clientApi("/newsletter", { method: "POST", body: { email } });
      setState("done");
    } catch (err) {
      setState("error");
      setMessage(
        err instanceof ClientApiError && err.status === 429
          ? "Too many tries. Please wait a minute."
          : "Please enter a valid email address.",
      );
    }
  }

  return (
    <section className="rounded-[20px] bg-ink px-6 py-10 text-white sm:px-10" aria-labelledby="newsletter-title">
      <div className="grid items-center gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h2 id="newsletter-title" className="font-display text-3xl font-extrabold tracking-[-0.025em]">
            One good book a week
          </h2>
          <p className="mt-2 max-w-[44ch] text-white/75">
            A short letter with a staff pick, a new arrival and a reading idea. No spam, unsubscribe any time.
          </p>
        </div>
        {state === "done" ? (
          <p className="flex items-center gap-2 text-lg font-semibold" role="status">
            <Check size={22} aria-hidden /> You’re on the list. Thank you!
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-2">
            <div className="flex flex-col gap-2 rounded-[14px] bg-white p-2 sm:flex-row">
              <label className="flex flex-1 items-center gap-2.5 pl-2.5 text-ink-3">
                <Mail size={18} aria-hidden />
                <span className="sr-only">Email address</span>
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 min-w-0 flex-1 text-base text-ink outline-none"
                />
              </label>
              <button
                type="submit"
                disabled={state === "busy"}
                className="h-11 rounded-[10px] bg-accent px-5 font-semibold text-white hover:bg-accent-ink disabled:opacity-60"
              >
                {state === "busy" ? "Subscribing…" : "Subscribe"}
              </button>
            </div>
            {state === "error" && (
              <p className="text-sm text-[#ffb4a8]" role="alert">
                {message}
              </p>
            )}
          </form>
        )}
      </div>
    </section>
  );
}
