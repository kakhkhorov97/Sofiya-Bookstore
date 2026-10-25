import { Controller, Get, Logger, Param, Query } from '@nestjs/common';
import {
  AuthorPage,
  BookDetail,
  BookListQuery,
  BookSummary,
  FormatInfo,
  FormatLookupQuery,
  GenreCount,
  Page,
} from '@sofiya/shared';
import { z } from 'zod';
import { RetrievalService } from '../ai/retrieval.service';
import { ZodPipe } from '../common/zod.pipe';
import { BooksService } from './books.service';

const Slug = new ZodPipe(
  z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
);

const SEARCH_CANDIDATES = 120;
const SIMILAR = 6;

@Controller()
export class BooksController {
  private readonly logger = new Logger(BooksController.name);

  constructor(
    private readonly books: BooksService,
    private readonly retrieval: RetrievalService,
  ) {}

  @Get('books')
  async list(
    @Query(new ZodPipe(BookListQuery)) query: BookListQuery,
  ): Promise<Page<BookSummary>> {
    const wantsRelevance =
      !!query.q && (query.sort === undefined || query.sort === 'relevance');
    if (wantsRelevance && this.retrieval.enabled) {
      try {
        const ranked = await this.retrieval.rank(
          query.q!,
          {
            genre: query.genre,
            format: query.format,
            inStock: query.inStock || undefined,
          },
          SEARCH_CANDIDATES,
        );
        return await this.books.list(
          query,
          ranked.map((r) => r.bookId),
        );
      } catch (err) {
        this.logger.warn(
          `Hybrid search failed, using keyword search: ${(err as Error).message}`,
        );
      }
    }
    return this.books.list(query);
  }

  @Get('books/:slug')
  detail(@Param('slug', Slug) slug: string): Promise<BookDetail> {
    return this.books.getBySlug(slug);
  }

  // "If you like this": nearest books by meaning, or popular books in the
  // same genre when the AI index is not available.
  @Get('books/:slug/similar')
  async similar(@Param('slug', Slug) slug: string): Promise<BookSummary[]> {
    const book = await this.books.idBySlug(slug);
    if (this.retrieval.enabled) {
      const ids = await this.retrieval.similar(book.id, SIMILAR);
      if (ids.length > 0) return this.books.summaries(ids);
    }
    return this.books.popularInGenre(book.genre, book.id, SIMILAR);
  }

  @Get('authors/:slug')
  author(@Param('slug', Slug) slug: string): Promise<AuthorPage> {
    return this.books.author(slug);
  }

  @Get('formats')
  formats(
    @Query(new ZodPipe(FormatLookupQuery)) query: FormatLookupQuery,
  ): Promise<FormatInfo[]> {
    return this.books.formatsByIds(query.ids);
  }

  @Get('genres')
  genres(): Promise<GenreCount[]> {
    return this.books.genres();
  }
}
