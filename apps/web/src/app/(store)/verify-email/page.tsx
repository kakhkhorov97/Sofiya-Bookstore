import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmEmail } from "@/components/EmailConfirmation";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Confirm your email", referrer: "no-referrer" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto w-[min(480px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Confirm your email</h1>
      {token ? (
        <ConfirmEmail token={token} />
      ) : (
        <div className="mt-8">
          <Notice tone="bad">
            This link is incomplete. <Link href="/account" className="font-semibold underline">Go to your account</Link>
          </Notice>
        </div>
      )}
    </div>
  );
}
