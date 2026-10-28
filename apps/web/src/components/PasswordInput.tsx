"use client";

import { Eye, EyeOff } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

// A password field with an eye button that shows or hides what was typed.
// Sits inside the caller's <label>, like a plain input.
export function PasswordInput(props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "className">) {
  const t = useTranslations("common");
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative mt-1.5 block">
      <input
        {...props}
        type={visible ? "text" : "password"}
        className="block h-12 w-full rounded-[10px] border border-line bg-white pl-3.5 pr-12 text-base font-normal outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t("hidePassword") : t("showPassword")}
        aria-pressed={visible}
        className="absolute inset-y-0 right-1 my-auto grid size-10 place-items-center rounded-[8px] text-ink-3 hover:bg-surface hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
      >
        {visible ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
      </button>
    </span>
  );
}
