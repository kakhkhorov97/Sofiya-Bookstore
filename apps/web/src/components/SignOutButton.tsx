"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";
import { buttonClass } from "./ui";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await clientApi("/auth/signout", { method: "POST" }).catch(() => undefined);
        router.replace("/");
        router.refresh();
      }}
      className={buttonClass.outline}
    >
      <LogOut size={18} aria-hidden /> {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
