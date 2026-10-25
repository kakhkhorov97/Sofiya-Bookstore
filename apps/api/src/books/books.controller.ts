import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  BookDetail,
  BookListQuery,
  BookSummary,
  GenreCount,
  Page,
} from '@sofiya/shared';
import { z } from 'zod';
import { ZodPipe } from '../common/zod.pipe';
import { BooksService } from './books.service';

const Slug = z
  .string()
  .max(200)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

@Controller()
export class BooksController {
  constructor(private readonly books: BooksService) {}

  @Get('books')
  list(
    @Query(new ZodPipe(BookListQuery)) query: BookListQuery,
  ): Promise<Page<BookSummary>> {
    return this.books.list(query);
  }

  @Get('books/:slug')
  detail(@Param('slug', new ZodPipe(Slug)) slug: string): Promise<BookDetail> {
    return this.books.getBySlug(slug);
  }

  @Get('genres')
  genres(): Promise<GenreCount[]> {
    return this.books.genres();
  }
}
