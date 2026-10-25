import Link from "next/link";

const BASE =
  "inline-flex h-[46px] items-center justify-center gap-2 rounded-[10px] px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-3 disabled:shadow-none";

export const buttonClass = {
  primary: `${BASE} bg-accent text-white hover:bg-accent-ink`,
  dark: `${BASE} bg-ink text-white hover:bg-black`,
  outline: `${BASE} bg-white text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink-3)]`,
};

export function ButtonLink({
  href,
  variant = "primary",
  children,
  className = "",
}: {
  href: string;
  variant?: keyof typeof buttonClass;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={`${buttonClass[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex h-9 shrink-0 items-center rounded-full border px-3.5 text-sm font-medium ${
        active ? "border-ink bg-ink text-white" : "border-line bg-white text-ink-2 hover:border-ink-3 hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

const TAG = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  muted: "bg-surface text-ink-2",
  accent: "bg-accent-soft text-accent-ink",
  bad: "bg-[#fde8e6] text-bad",
};

export function Tag({ tone = "muted", children }: { tone?: keyof typeof TAG; children: React.ReactNode }) {
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-semibold ${TAG[tone]}`}>
      {children}
    </span>
  );
}

export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-[min(1240px,calc(100%-32px))] ${className}`}>{children}</div>;
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="pt-10">
      <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{children}</h1>
      {sub && <p className="mt-2 text-ink-3">{sub}</p>}
    </div>
  );
}

export function Notice({ tone = "warn", children }: { tone?: "warn" | "bad" | "ok" | "accent"; children: React.ReactNode }) {
  const tones = {
    warn: "bg-warn-soft text-warn",
    bad: "bg-[#fde8e6] text-bad",
    ok: "bg-ok-soft text-ok",
    accent: "bg-accent-soft text-accent-ink",
  };
  return (
    <div role="status" className={`rounded-[12px] px-4 py-3 text-[15px] font-medium ${tones[tone]}`}>
      {children}
    </div>
  );
}
