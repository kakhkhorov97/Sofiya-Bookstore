import { abstainRate, firstHit, score } from './metrics';
import type { EvalQuestion } from './questions';

const q = (
  relevant: string[],
  kind: EvalQuestion['kind'] = 'direct',
): EvalQuestion => ({
  q: 'x',
  kind,
  relevant,
});

describe('RAG evaluation metrics', () => {
  it('finds the position of the first correct book', () => {
    expect(
      firstHit({ question: q(['b', 'c']), returned: ['a', 'c', 'b'] }),
    ).toBe(2);
    expect(firstHit({ question: q(['z']), returned: ['a', 'b'] })).toBeNull();
  });

  it('computes hit@1, hit@5 and MRR over answerable questions', () => {
    const s = score([
      { question: q(['a']), returned: ['a'] }, // rank 1
      { question: q(['b']), returned: ['x', 'y', 'b'] }, // rank 3
      { question: q(['c']), returned: ['1', '2', '3', '4', '5', 'c'] }, // rank 6
      { question: q(['d']), returned: [] }, // miss
      { question: q([], 'none'), returned: ['a'] }, // not counted
    ]);
    expect(s.questions).toBe(4);
    expect(s.hitAt1).toBe(0.25);
    expect(s.hitAt5).toBe(0.5);
    expect(s.mrr).toBeCloseTo((1 + 1 / 3 + 1 / 6) / 4);
  });

  it('measures how often unanswerable questions return nothing', () => {
    expect(
      abstainRate([
        { question: q([], 'none'), returned: [] },
        { question: q([], 'none'), returned: ['a'] },
      ]),
    ).toBe(0.5);
  });
});
