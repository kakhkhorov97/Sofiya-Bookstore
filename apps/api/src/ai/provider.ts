import { GoogleGenAI } from '@google/genai';
import type { Env } from '../config/env';
import { EMBEDDING_DIMENSIONS } from '../db/schema';
import { terms } from './text';

export type EmbedKind = 'document' | 'query';

export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiProvider {
  readonly name: string;
  readonly embedModel: string;
  // Cosine similarity a book needs to count as a meaning match.
  readonly minSimilarity: number;
  embed(
    texts: string[],
    kind: EmbedKind,
    signal?: AbortSignal,
  ): Promise<number[][]>;
  streamAnswer(
    system: string,
    turns: ChatTurn[],
    signal?: AbortSignal,
  ): AsyncIterable<string>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');

const normalize = (v: number[]) => {
  const len = Math.hypot(...v) || 1;
  return v.map((x) => x / len);
};

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;

  constructor(
    apiKey: string,
    readonly embedModel: string,
    private readonly chatModel: string,
    readonly minSimilarity: number,
  ) {
    this.client = new GoogleGenAI({ apiKey });
  }

  async embed(
    texts: string[],
    kind: EmbedKind,
    signal?: AbortSignal,
  ): Promise<number[][]> {
    const res = await this.client.models.embedContent({
      model: this.embedModel,
      contents: texts,
      config: {
        taskType:
          kind === 'document' ? 'RETRIEVAL_DOCUMENT' : 'RETRIEVAL_QUERY',
        outputDimensionality: EMBEDDING_DIMENSIONS,
        abortSignal: signal,
      },
    });
    const vectors = (res.embeddings ?? []).map((e) => e.values ?? []);
    if (
      vectors.length !== texts.length ||
      vectors.some((v) => v.length !== EMBEDDING_DIMENSIONS)
    ) {
      throw new Error('Gemini returned an unexpected embedding shape');
    }
    // Truncated (768-d) Gemini embeddings are not unit length; cosine
    // distance does not care, but normalising keeps scores comparable.
    return vectors.map(normalize);
  }

  async *streamAnswer(
    system: string,
    turns: ChatTurn[],
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const stream = await this.client.models.generateContentStream({
      model: this.chatModel,
      contents: turns.map((t) => ({
        role: t.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: t.text }],
      })),
      config: {
        systemInstruction: system,
        temperature: 0.2,
        maxOutputTokens: 700,
        abortSignal: signal,
      },
    });
    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }
}

// Deterministic offline provider for tests and local demos without a key.
// Embeddings are hashed bags of words, so related words do not match,
// but the whole RAG pipeline (pgvector, fusion, citations) runs for real.
export class FakeProvider implements AiProvider {
  readonly name = 'fake';
  readonly embedModel = 'fake-bag-of-words';
  // Bag-of-words vectors share nothing (0) unless a word overlaps.
  readonly minSimilarity = 0.05;

  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(
      texts.map((text) => {
        const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
        for (const t of terms(text)) {
          let h = 2166136261;
          for (let i = 0; i < t.length; i++)
            h = Math.imul(h ^ t.charCodeAt(i), 16777619);
          v[(h >>> 0) % EMBEDDING_DIMENSIONS] += 1;
        }
        return normalize(v);
      }),
    );
  }

  async *streamAnswer(
    system: string,
    turns: ChatTurn[],
  ): AsyncIterable<string> {
    // Cites the numbered books the prompt supplied, like a well-behaved model.
    const last = turns[turns.length - 1]?.text ?? '';
    const titles = [...last.matchAll(/^\[(\d+)\] "([^"]+)"/gm)].slice(0, 3);
    const answer = titles.length
      ? `From our shelves: ${titles.map(([, n, t]) => `${t} [${n}]`).join(', ')}.`
      : "I couldn't find a good match in our catalogue.";
    for (const word of answer.split(/(?<= )/)) {
      await Promise.resolve();
      yield word;
    }
    void system;
  }
}

export function createProvider(env: Env): AiProvider | null {
  if (env.AI_PROVIDER === 'fake') return new FakeProvider();
  if (env.GEMINI_API_KEY) {
    return new GeminiProvider(
      env.GEMINI_API_KEY,
      env.GEMINI_EMBED_MODEL,
      env.GEMINI_CHAT_MODEL,
      env.AI_MIN_SIMILARITY,
    );
  }
  return null;
}
