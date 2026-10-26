import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IndexJobState, IndexStatus } from '@sofiya/shared';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import { indexBooks } from './indexer';
import { AI_PROVIDER, AiProvider } from './provider';
import { bookEmbeddingText, contentHash, EmbeddableBook } from './text';

// Runs the embedding indexer in the background, one run at a time. A save
// that arrives mid-run queues exactly one more run, so the last edit is
// always indexed without piling up jobs.
@Injectable()
export class IndexJobService {
  private readonly logger = new Logger(IndexJobService.name);
  private state: IndexJobState = {
    running: false,
    startedAt: null,
    finishedAt: null,
    lastResult: null,
    lastError: null,
  };
  private again = false;
  private current: Promise<void> | null = null;

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
  ) {}

  get enabled(): boolean {
    return this.provider !== null;
  }

  status(): IndexJobState {
    return { ...this.state };
  }

  // Index status of one book, given the hash stored with its embedding.
  statusOf(
    book: EmbeddableBook & { status: string },
    storedHash: string | null,
  ): IndexStatus {
    if (!this.provider) return 'AI_OFF';
    if (book.status !== 'LIVE') return 'NOT_LIVE';
    if (!storedHash) return 'MISSING';
    const expected = contentHash(
      bookEmbeddingText(book),
      this.provider.embedModel,
    );
    return expected === storedHash ? 'INDEXED' : 'STALE';
  }

  // Fire and forget; returns false when AI is off.
  trigger(): boolean {
    if (!this.provider) return false;
    if (this.current) {
      this.again = true;
      return true;
    }
    this.current = this.run().finally(() => {
      this.current = null;
      if (this.again) {
        this.again = false;
        this.trigger();
      }
    });
    return true;
  }

  // For tests and scripts that need the run to finish.
  async idle(): Promise<void> {
    while (this.current) await this.current;
  }

  private async run(): Promise<void> {
    this.state = {
      ...this.state,
      running: true,
      startedAt: new Date().toISOString(),
      lastError: null,
    };
    try {
      const result = await indexBooks(this.db, this.provider!, (m) =>
        this.logger.log(m),
      );
      this.state.lastResult = result;
    } catch (err) {
      this.state.lastError = (err as Error).message.slice(0, 300);
      this.logger.warn(`Indexing failed: ${this.state.lastError}`);
    } finally {
      this.state.running = false;
      this.state.finishedAt = new Date().toISOString();
    }
  }
}
