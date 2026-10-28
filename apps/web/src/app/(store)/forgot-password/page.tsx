import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/PasswordResetForms";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <div className="mx-auto w-[min(420px,calc(100%-32px))] py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em]">Forgot your password?</h1>
      <p className="mt-2 text-ink-2">Enter your email and we’ll send you a link to choose a new one.</p>
      <ForgotPasswordForm />
    </div>
  );
}
