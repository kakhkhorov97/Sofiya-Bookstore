import type { EvalKind, EvalQuestion } from './questions';

export interface QuestionResult {
  question: EvalQuestion;
  // Slugs in the order retrieval returned them.
  returned: string[];
}

export interface Scores {
  questions: number;
  hitAt1: number; // share with a correct book first
  hitAt5: number; // share with a correct book in the top five
  mrr: number; // mean reciprocal rank of the first correct book (0 if none in the list)
}

// 1-based position of the first correct book, or null.
export function firstHit(r: QuestionResult): number | null {
  const i = r.returned.findIndex((slug) => r.question.relevant.includes(slug));
  return i === -1 ? null : i + 1;
}

export function score(results: QuestionResult[]): Scores {
  const answerable = results.filter((r) => r.question.kind !== 'none');
  const n = answerable.length;
  if (n === 0) return { questions: 0, hitAt1: 0, hitAt5: 0, mrr: 0 };
  let h1 = 0;
  let h5 = 0;
  let rr = 0;
  for (const r of answerable) {
    const rank = firstHit(r);
    if (rank === null) continue;
    if (rank === 1) h1++;
    if (rank <= 5) h5++;
    rr += 1 / rank;
  }
  return { questions: n, hitAt1: h1 / n, hitAt5: h5 / n, mrr: rr / n };
}

// For questions with no right answer: the share that returned nothing.
export function abstainRate(results: QuestionResult[]): number {
  const none = results.filter((r) => r.question.kind === 'none');
  return none.length
    ? none.filter((r) => r.returned.length === 0).length / none.length
    : 1;
}

export function byKind(
  results: QuestionResult[],
): Record<Exclude<EvalKind, 'none'>, Scores> {
  const of = (kind: EvalKind) =>
    score(results.filter((r) => r.question.kind === kind));
  return {
    direct: of('direct'),
    paraphrase: of('paraphrase'),
    theme: of('theme'),
  };
}
