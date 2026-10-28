import { getFormatter, getTranslations } from "next-intl/server";
import { Container } from "./ui";

export const CONTACT_EMAIL = "hello@sofiya.store";
// Bump when the wording of either page changes.
const UPDATED = new Date("2026-10-28T00:00:00+09:00");

// Privacy policy and terms share one layout: title, date, intro, then
// sections whose texts live in messages under `${ns}.${section}.${key}`.
// The section with a list (what we collect) renders its keys as bullets.
export async function LegalPage({
  ns,
  sections,
}: {
  ns: "privacy" | "terms";
  sections: { id: string; keys: string[]; list?: boolean }[];
}) {
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const rich = (key: string) =>
    t.rich(key, {
      mail: () => (
        <a href={`mailto:${CONTACT_EMAIL}`} className="font-semibold text-accent underline underline-offset-2">
          {CONTACT_EMAIL}
        </a>
      ),
    });

  return (
    <Container className="py-12">
      <article className="max-w-[68ch]">
        <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{t(`${ns}.title`)}</h1>
        <p className="mt-3 text-sm text-ink-3">
          {t("legal.updated", { date: format.dateTime(UPDATED, { dateStyle: "long" }) })}
        </p>
        <p className="mt-6 text-lg leading-relaxed text-ink-2">{t(`${ns}.intro`)}</p>
        {sections.map(({ id, keys, list }) => (
          <section key={id} className="mt-10">
            <h2 className="font-display text-2xl font-extrabold tracking-[-0.02em]">{t(`${ns}.${id}.title`)}</h2>
            {list ? (
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-ink-2 marker:text-ink-3">
                {keys.map((k) => (
                  <li key={k}>{rich(`${ns}.${id}.${k}`)}</li>
                ))}
              </ul>
            ) : (
              keys.map((k) => (
                <p key={k} className="mt-3 leading-relaxed text-ink-2">
                  {rich(`${ns}.${id}.${k}`)}
                </p>
              ))
            )}
          </section>
        ))}
      </article>
    </Container>
  );
}
