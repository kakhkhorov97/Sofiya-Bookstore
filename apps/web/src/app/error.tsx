"use client";

import { buttonClass, Container } from "@/components/ui";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <Container className="py-20 text-center">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Something went wrong</h1>
      <p className="mx-auto mt-3 max-w-[44ch] text-ink-2">
        We couldn’t reach the bookstore service. Check your connection and try again in a moment.
      </p>
      <button type="button" onClick={reset} className={`${buttonClass.primary} mt-8`}>
        Try again
      </button>
    </Container>
  );
}
