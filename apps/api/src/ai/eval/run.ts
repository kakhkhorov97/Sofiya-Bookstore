// Measures how well Ask Sofiya's retrieval finds the right books.
//   npm run ai:eval -w @sofiya/api
// Needs GEMINI_API_KEY and an indexed catalogue (npm run ai:index). Writes
// docs/rag-eval.md at the repository root.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { inArray } from 'drizzle-orm';
import { loadEnv } from '../../config/env';
import { createDb } from '../../db/client';
import { books } from '../../db/schema';
import { createProvider } from '../provider';
import { RetrievalService, type RankMode } from '../retrieval.service';
import {
  abstainRate,
  byKind,
  firstHit,
  score,
  type QuestionResult,
  type Scores,
} from './metrics';
import { EVAL_QUESTIONS } from './questions';

const TOP = 10;
const MODES: RankMode[] = ['hybrid', 'keyword', 'meaning'];

const pct = (x: number) => `${Math.round(x * 100)}%`;
const row = (label: string, s: Scores, abstain?: number) =>
  `| ${label} | ${s.questions} | ${pct(s.hitAt1)} | ${pct(s.hitAt5)} | ${s.mrr.toFixed(2)} |${
    abstain === undefined ? '' : ` ${pct(abstain)} |`
  }`;

async function main() {
  const env = loadEnv();
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  const provider = createProvider(env);
  if (!provider || provider.name === 'fake') {
    throw new Error(
      'Set GEMINI_API_KEY in apps/api/.env: the evaluation measures the real model.',
    );
  }
  const { db, close } = createDb(env.DATABASE_URL, { max: 2 });
  try {
    // Every expected slug must exist, or the set has drifted from the catalogue.
    const expected = [...new Set(EVAL_QUESTIONS.flatMap((q) => q.relevant))];
    const found = await db
      .select({ id: books.id, slug: books.slug })
      .from(books)
      .where(inArray(books.slug, expected));
    const missing = expected.filter((s) => !found.some((b) => b.slug === s));
    if (missing.length)
      throw new Error(
        `Unknown slugs in the question set: ${missing.join(', ')}`,
      );
    const allBooks = await db
      .select({ id: books.id, slug: books.slug })
      .from(books);
    const slugOf = new Map(allBooks.map((b) => [b.id, b.slug]));

    const retrieval = new RetrievalService(db, provider);
    const results = {} as Record<RankMode, QuestionResult[]>;
    for (const mode of MODES) {
      results[mode] = [];
      for (const question of EVAL_QUESTIONS) {
        const ranked = await retrieval.rank(question.q, {}, TOP, 'KRW', mode);
        results[mode].push({
          question,
          returned: ranked.map((r) => slugOf.get(r.bookId) ?? r.bookId),
        });
      }
      console.log(`${mode}: ${JSON.stringify(score(results[mode]))}`);
    }

    const hybrid = results.hybrid;
    const kinds = byKind(hybrid);
    const notFirst = hybrid.filter((r) => {
      const rank = firstHit(r);
      return (
        r.question.kind !== 'none' && rank !== null && rank > 1 && rank <= 5
      );
    });
    const misses = hybrid.filter(
      (r) => r.question.kind !== 'none' && (firstHit(r) ?? 99) > 5,
    );
    const noneAnswered = hybrid.filter(
      (r) => r.question.kind === 'none' && r.returned.length > 0,
    );

    const lines = [
      '# Ask Sofiya retrieval evaluation',
      '',
      `Run on ${new Date().toISOString().slice(0, 10)} with \`${env.GEMINI_EMBED_MODEL}\`, similarity floor ${env.AI_MIN_SIMILARITY}, window ${env.AI_SIMILARITY_WINDOW}, over ${EVAL_QUESTIONS.length} fixed questions (\`apps/api/src/ai/eval/questions.ts\`). Regenerate with \`npm run ai:eval -w @sofiya/api\`.`,
      '',
      '- **hit@1**: a correct book is the first result. **hit@5**: one is in the top five (Ask Sofiya shows five). **MRR**: mean reciprocal rank of the first correct book in the top 10 (1.00 = always first).',
      '- **No-match**: for questions the catalogue cannot answer, the share that returned no books (Ask Sofiya then says so instead of guessing).',
      '',
      '## How to read this',
      '',
      '- The questions were written by the developer with the catalogue in view, so the scores are optimistic; treat them as a regression check (does a change make things better or worse?) more than an absolute measure. Add real questions from the admin "What readers asked" list over time.',
      '- Meaning search alone can score highest here, but the site keeps hybrid search: keyword matching still answers when Gemini is slow or down, finds partial titles ("Baskerv") and exact names, and the AI filters and the books list use it.',
      '- Keyword hits only in a description count half against meaning matches (WEAK_KEYWORD_WEIGHT in retrieval.service.ts); hits on a title or author count fully.',
      '',
      '## Hybrid vs. each half',
      '',
      '| Mode | Questions | hit@1 | hit@5 | MRR | No-match |',
      '|---|---|---|---|---|---|',
      ...MODES.map((m) => row(m, score(results[m]), abstainRate(results[m]))),
      '',
      '## Hybrid by question type',
      '',
      '| Type | Questions | hit@1 | hit@5 | MRR |',
      '|---|---|---|---|---|',
      row('direct (title, author, character)', kinds.direct),
      row('paraphrase (described in other words)', kinds.paraphrase),
      row('theme (mood or topic, several right books)', kinds.theme),
      '',
      '## Hybrid: correct book found but not first',
      '',
      ...(notFirst.length
        ? notFirst.map(
            (r) =>
              `- "${r.question.q}": first correct at #${firstHit(r)}; above it: ${r.returned.slice(0, (firstHit(r) ?? 1) - 1).join(', ')}`,
          )
        : ['None.']),
      '',
      '## Hybrid misses (no correct book in the top five)',
      '',
      ...(misses.length
        ? misses.map(
            (r) =>
              `- "${r.question.q}": expected ${r.question.relevant.join(', ')}; got ${r.returned.slice(0, 5).join(', ') || 'nothing'}`,
          )
        : ['None.']),
      '',
      '## Unanswerable questions that still returned books',
      '',
      ...(noneAnswered.length
        ? noneAnswered.map(
            (r) => `- "${r.question.q}": ${r.returned.slice(0, 3).join(', ')}`,
          )
        : ['None.']),
      '',
    ];
    const out = path.resolve(__dirname, '../../../../../docs/rag-eval.md');
    writeFileSync(out, lines.join('\n'));
    console.log(`\n${lines.slice(8, 22).join('\n')}\n\nReport: ${out}`);
  } finally {
    await close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
