// Typographic jacket used until real cover images are uploaded (milestone 3).
// Colour and motif are derived from the slug, so a book always looks the same.
const PALETTE = [
  { bg: "#24466b", ink: "#ffffff", accent: "#e8c25a" },
  { bg: "#6a2a4c", ink: "#ffffff", accent: "#f4e9ef" },
  { bg: "#d79a2b", ink: "#1a1305", accent: "#1a1305" },
  { bg: "#2c6a4a", ink: "#ffffff", accent: "#d9efe2" },
  { bg: "#202227", ink: "#ffffff", accent: "#e4572e" },
  { bg: "#a63f26", ink: "#ffffff", accent: "#f6d9a8" },
  { bg: "#4448a8", ink: "#ffffff", accent: "#cfd1ff" },
  { bg: "#6b5e44", ink: "#ffffff", accent: "#f1e4c4" },
];

// "Jacob and Wilhelm Grimm" -> "Grimm"; "Amy Brown and Greg Wilson (eds.)" -> "Wilson".
export function coverName(author: string): string {
  return author.replace(/\(.*?\)/g, "").trim().split(/\s+/).pop() ?? author;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

interface Props {
  slug: string;
  title: string;
  author: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZES = {
  sm: { title: "text-[9px]", author: "text-[6px]", pad: "p-1.5", radius: "rounded-[2px_4px_4px_2px]" },
  md: { title: "text-[15px] sm:text-[17px]", author: "text-[10px]", pad: "p-[10%]", radius: "rounded-[3px_8px_8px_3px]" },
  lg: { title: "text-3xl sm:text-4xl", author: "text-xs", pad: "p-[9%]", radius: "rounded-[4px_12px_12px_4px]" },
};

export function BookCover({ slug, title, author, size = "md", className = "" }: Props) {
  const h = hash(slug);
  const c = PALETTE[h % PALETTE.length];
  const motif = (h >> 3) % 3;
  const s = SIZES[size];
  const surname = coverName(author);

  return (
    <div
      role="img"
      aria-label={`Cover of ${title}`}
      className={`relative flex aspect-[2/3] flex-col justify-between overflow-hidden ${s.pad} ${s.radius} shadow-[inset_3px_0_0_rgba(0,0,0,0.15),0_2px_4px_rgba(0,0,0,0.08),0_10px_22px_rgba(21,23,28,0.14)] ${className}`}
      style={{ background: c.bg, color: c.ink }}
    >
      <span className={`${s.author} font-semibold uppercase tracking-[0.08em] opacity-85`}>{surname}</span>
      {motif === 0 && <span className="absolute inset-x-[10%] top-[52%] h-[2px]" style={{ background: c.accent }} />}
      {motif === 1 && (
        <span
          className="absolute right-[14%] top-[36%] aspect-square w-[26%] rounded-full border-2"
          style={{ borderColor: c.accent }}
        />
      )}
      {motif === 2 && (
        <span
          className="absolute left-[10%] top-[42%] h-[30%] w-[30%] border-b-2 border-l-2"
          style={{ borderColor: c.accent }}
        />
      )}
      <span className={`relative font-display font-bold leading-[1.05] tracking-[-0.01em] ${s.title}`}>{title}</span>
    </div>
  );
}
