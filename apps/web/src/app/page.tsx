import { GENRES, formatUsd, FREE_DELIVERY_FROM_CENTS } from "@sofiya/shared";

const genreLabel = (g: string) =>
  g.charAt(0) + g.slice(1).toLowerCase().replace("_", " ");

// Milestone 0 placeholder. The real storefront arrives in milestone 2.
export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-[min(1240px,calc(100%-32px))] flex-col justify-center py-16">
      <p className="font-display text-2xl font-extrabold tracking-tight">Sofiya</p>
      <h1 className="mt-6 max-w-[13ch] font-display text-5xl font-extrabold leading-[1.02] tracking-[-0.035em] md:text-6xl">
        Find your next book by describing it.
      </h1>
      <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
        The new Sofiya is being built. Free delivery on orders over{" "}
        {formatUsd(FREE_DELIVERY_FROM_CENTS)}.
      </p>
      <ul className="mt-8 flex flex-wrap gap-2" aria-label="Genres">
        {GENRES.map((g) => (
          <li
            key={g}
            className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink-2"
          >
            {genreLabel(g)}
          </li>
        ))}
      </ul>
    </main>
  );
}
