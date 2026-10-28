import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/PasswordResetForms";
import { Notice } from "@/components/ui";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Choose a new password</h1>
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <div className="mt-8">
          <Notice tone="bad">
            This link is incomplete.{" "}
            <Link href="/forgot-password" className="font-semibold underline">
              Get a new link
            </Link>
          </Notice>
        </div>
      )}
    </div>
  );
}
