import Link from "next/link";
import { ButtonLink, Container } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="flex-1">
      <div className="border-b border-line">
        <Container className="flex h-16 items-center">
          <Link href="/" className="font-display text-[26px] font-extrabold tracking-[-0.03em]">
            Sofiya<span className="text-accent">.</span>
          </Link>
        </Container>
      </div>
      <Container className="py-20 text-center">
        <p className="text-sm font-semibold text-accent">404</p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-[-0.03em]">We couldn’t find that page</h1>
        <p className="mt-3 text-ink-2">The book or page may have moved, or the link has a typo.</p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/books">Browse books</ButtonLink>
          <ButtonLink href="/" variant="outline">
            Go home
          </ButtonLink>
        </div>
      </Container>
    </main>
  );
}
