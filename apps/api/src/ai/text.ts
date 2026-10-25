import { createHash } from 'node:crypto';

const STOP_WORDS = new Set(
  'a an and are as at be but by for from has have i in into is it its me my of on or so that the their them then there these they this to too very was we were what when where which who why will with would you your want like book books something some read reading'.split(
    ' ',
  ),
);

// Lower-case word stems, good enough for matching a passage to a question.
export function terms(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .map((w) =>
      w.replace(/(ies|es|s|ing|ed)$/, (m) => (m === 'ies' ? 'y' : '')),
    );
}

// The sentence of a description that shares the most words with the question.
export function bestPassage(description: string, question: string): string {
  const sentences = description
    .match(/[^.!?]+[.!?]+/g)
    ?.map((s) => s.trim()) ?? [description];
  const wanted = new Set(terms(question));
  let best = sentences[0];
  let bestScore = 0;
  for (const s of sentences) {
    const score = terms(s).filter((t) => wanted.has(t)).length;
    if (score > bestScore) {
      best = s;
      bestScore = score;
    }
  }
  return best;
}

export interface EmbeddableBook {
  title: string;
  author: string;
  genre: string;
  description: string;
}

export function bookEmbeddingText(b: EmbeddableBook): string {
  const genre = b.genre.toLowerCase().replace('_', ' ');
  return `${b.title}\nby ${b.author}\nGenre: ${genre}\n${b.description}`;
}

export function contentHash(text: string, model: string): string {
  return createHash('sha256').update(`${model}\n${text}`).digest('hex');
}
