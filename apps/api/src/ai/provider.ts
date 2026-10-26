import { GoogleGenAI } from '@google/genai';
import { Logger } from '@nestjs/common';
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
  // The best meaning match must reach this cosine similarity, and other
  // books count only within `similarityWindow` of that best match.
  readonly minSimilarity: number;
  readonly similarityWindow: number;
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

// How long a model may take to send its first words before we try the
// fallback model (busy models can queue for 20s+ before failing).
const FIRST_TOKEN_TIMEOUT_MS = 10_000;

export class GeminiProvider implements AiProvider {
  readonly name = 'gemini';
  private readonly client: GoogleGenAI;
  private readonly logger = new Logger(GeminiProvider.name);

  constructor(
    apiKey: string,
    readonly embedModel: string,
    private readonly chatModel: string,
    private readonly fallbackModel: string | undefined,
    readonly minSimilarity: number,
    readonly similarityWindow: number,
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

  // Streams from the main model; if it errors (busy, quota, retired) or
  // stays silent too long before its first words, retries once on the
  // fallback model. Once text has been sent, errors are passed on.
  async *streamAnswer(
    system: string,
    turns: ChatTurn[],
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const models = [...new Set([this.chatModel, this.fallbackModel])].filter(
      (m): m is string => !!m,
    );
    for (const [i, model] of models.entries()) {
      const firstToken = new AbortController();
      const timer = setTimeout(
        () => firstToken.abort(),
        FIRST_TOKEN_TIMEOUT_MS,
      );
      const abortSignal = signal
        ? AbortSignal.any([signal, firstToken.signal])
        : firstToken.signal;
      let started = false;
      try {
        const stream = await this.client.models.generateContentStream({
          model,
          contents: turns.map((t) => ({
            role: t.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: t.text }],
          })),
          config: {
            systemInstruction: system,
            temperature: 0.2,
            // Room for "thinking" models: their reasoning counts against this.
            maxOutputTokens: 2048,
            abortSignal,
          },
        });
        for await (const chunk of stream) {
          if (!chunk.text) continue;
          if (!started) {
            started = true;
            clearTimeout(timer);
          }
          yield chunk.text;
        }
        if (started) return;
      } catch (err) {
        if (started || signal?.aborted || i === models.length - 1) throw err;
        this.logger.warn(
          `${model} failed before answering (${(err as Error).message.slice(0, 120)}); trying ${models[i + 1]}`,
        );
      } finally {
        clearTimeout(timer);
      }
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
  readonly similarityWindow = 1;

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
      env.GEMINI_FALLBACK_MODEL,
      env.AI_MIN_SIMILARITY,
      env.AI_SIMILARITY_WINDOW,
    );
  }
  return null;
}
