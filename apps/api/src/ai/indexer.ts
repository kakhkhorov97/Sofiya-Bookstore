// Embeds every live book whose text changed since it was last embedded.
//   npm run ai:index -w @sofiya/api
import { sql } from 'drizzle-orm';
import { loadEnv } from '../config/env';
import { createDb, Db } from '../db/client';
import type { AiProvider } from './provider';
import { createProvider } from './provider';
import { bookEmbeddingText, contentHash } from './text';

const BATCH = 50;
const MAX_RETRIES = 6;

// Gemini's free tier allows ~100 embedded texts per minute. On a 429 it says
// how long to wait ("Please retry in 4.96s"); honour that and try again.
export function retryDelayMs(err: unknown): number | null {
  const text = err instanceof Error ? err.message : String(err);
  if (!/429|RESOURCE_EXHAUSTED|quota/i.test(text)) return null;
  const seconds =
    /retry in ([\d.]+)s/i.exec(text)?.[1] ??
    /"retryDelay":"(\d+)s"/.exec(text)?.[1];
  return Math.ceil((seconds ? Number(seconds) : 30) * 1000) + 1000;
}

async function embedWithRetry(
  provider: AiProvider,
  texts: string[],
  log: (msg: string) => void,
): Promise<number[][]> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await provider.embed(texts, 'document');
    } catch (err) {
      const wait = retryDelayMs(err);
      if (wait === null || attempt > MAX_RETRIES) throw err;
      log(
        `Rate limited by ${provider.name}; waiting ${Math.round(wait / 1000)}s (attempt ${attempt}/${MAX_RETRIES})`,
      );
      await new Promise((r) => setTimeout(r, wait));
    }
  }
}

export interface IndexResult {
  embedded: number;
  unchanged: number;
  removed: number;
}

export async function indexBooks(
  db: Db,
  provider: AiProvider,
  log: (msg: string) => void = () => undefined,
): Promise<IndexResult> {
  const rows = await db.execute<{
    id: string;
    title: string;
    author: string;
    genre: string;
    description: string;
    content_hash: string | null;
  }>(sql`
    SELECT b.id, b.title, b.author, b.genre, b.description, e.content_hash
    FROM books b LEFT JOIN book_embeddings e ON e.book_id = b.id
    WHERE b.status = 'LIVE'`);

  const todo = rows
    .map((r) => {
      const text = bookEmbeddingText(r);
      return {
        id: r.id,
        text,
        hash: contentHash(text, provider.embedModel),
        old: r.content_hash,
      };
    })
    .filter((r) => r.hash !== r.old);

  for (let i = 0; i < todo.length; i += BATCH) {
    const batch = todo.slice(i, i + BATCH);
    const vectors = await embedWithRetry(
      provider,
      batch.map((b) => b.text),
      log,
    );
    for (const [j, b] of batch.entries()) {
      const literal = `[${vectors[j].join(',')}]`;
      await db.execute(sql`
        INSERT INTO book_embeddings (book_id, embedding, content_hash, model, updated_at)
        VALUES (${b.id}, ${literal}::vector, ${b.hash}, ${provider.embedModel}, now())
        ON CONFLICT (book_id) DO UPDATE
        SET embedding = EXCLUDED.embedding, content_hash = EXCLUDED.content_hash,
            model = EXCLUDED.model, updated_at = now()`);
    }
    log(`Embedded ${Math.min(i + BATCH, todo.length)} / ${todo.length}`);
  }

  // Books that were paused or deleted should not be recommended.
  const removed = await db.execute(sql`
    DELETE FROM book_embeddings e USING books b
    WHERE b.id = e.book_id AND b.status <> 'LIVE'
    RETURNING e.book_id`);

  return {
    embedded: todo.length,
    unchanged: rows.length - todo.length,
    removed: removed.length,
  };
}

if (require.main === module) {
  const env = loadEnv();
  const provider = createProvider(env);
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  if (!provider) {
    console.error('No AI provider: set GEMINI_API_KEY in apps/api/.env first.');
    process.exit(1);
  }
  const { db, close } = createDb(env.DATABASE_URL, { max: 1 });
  indexBooks(db, provider, (m) => console.log(m))
    .then((r) =>
      console.log(
        `Done with ${provider.name}: ${r.embedded} embedded, ${r.unchanged} unchanged, ${r.removed} removed`,
      ),
    )
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => void close());
}
