"use client";

import { useTranslations } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SortSelect({ value, options }: { value: string; options: { value: string; label: string }[] }) {
  const t = useTranslations("sort");
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (
    <label className="flex items-center gap-2 text-sm font-medium text-ink-2">
      {t("label")}
      <select
        value={value}
        onChange={(e) => {
          const next = new URLSearchParams(params.toString());
          next.set("sort", e.target.value);
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`);
        }}
        className="h-10 rounded-[10px] border border-line bg-white px-3 font-semibold text-ink outline-none focus:ring-2 focus:ring-accent"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
