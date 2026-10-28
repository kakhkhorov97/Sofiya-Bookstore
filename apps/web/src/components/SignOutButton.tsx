"use client";

import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { useSignOut } from "@/lib/useSignOut";
import { buttonClass } from "./ui";

export function SignOutButton() {
  const signOut = useSignOut();
  const t = useTranslations("accountMenu");
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await signOut();
      }}
      className={buttonClass.outline}
    >
      <LogOut size={18} aria-hidden /> {busy ? t("signingOut") : t("signOut")}
    </button>
  );
}
