"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { useSignOut } from "@/lib/useSignOut";
import { buttonClass } from "./ui";

export function SignOutButton() {
  const signOut = useSignOut();
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
      <LogOut size={18} aria-hidden /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
