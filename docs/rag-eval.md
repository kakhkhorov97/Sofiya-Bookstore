# Ask Sofiya retrieval evaluation

Run on 2026-10-28 with `gemini-embedding-001`, similarity floor 0.6, window 0.06, over 45 fixed questions (`apps/api/src/ai/eval/questions.ts`). Regenerate with `npm run ai:eval -w @sofiya/api`.

- **hit@1**: a correct book is the first result. **hit@5**: one is in the top five (Ask Sofiya shows five). **MRR**: mean reciprocal rank of the first correct book in the top 10 (1.00 = always first).
- **No-match**: for questions the catalogue cannot answer, the share that returned no books (Ask Sofiya then says so instead of guessing).

## How to read this

- The questions were written by the developer with the catalogue in view, so the scores are optimistic; treat them as a regression check (does a change make things better or worse?) more than an absolute measure. Add real questions from the admin "What readers asked" list over time.
- Meaning search alone can score highest here, but the site keeps hybrid search: keyword matching still answers when Gemini is slow or down, finds partial titles ("Baskerv") and exact names, and the AI filters and the books list use it.
- Keyword hits only in a description count half against meaning matches (WEAK_KEYWORD_WEIGHT in retrieval.service.ts); hits on a title or author count fully.

## Hybrid vs. each half

| Mode | Questions | hit@1 | hit@5 | MRR | No-match |
|---|---|---|---|---|---|
| hybrid | 40 | 93% | 100% | 0.95 | 100% |
| keyword | 40 | 75% | 85% | 0.79 | 100% |
| meaning | 40 | 100% | 100% | 1.00 | 100% |

## Hybrid by question type

| Type | Questions | hit@1 | hit@5 | MRR |
|---|---|---|---|---|
| direct (title, author, character) | 10 | 100% | 100% | 1.00 |
| paraphrase (described in other words) | 15 | 93% | 100% | 0.97 |
| theme (mood or topic, several right books) | 15 | 87% | 100% | 0.91 |

## Hybrid: correct book found but not first

- "man stranded alone on an island for decades": first correct at #2; above it: the-island-of-doctor-moreau-wells
- "dystopian future societies": first correct at #3; above it: flatland-abbott, herland-gilman
- "the Russian revolution": first correct at #3; above it: the-french-revolution-a-history-carlyle, anna-karenina-tolstoy

## Hybrid misses (no correct book in the top five)

None.

## Unanswerable questions that still returned books

None.
