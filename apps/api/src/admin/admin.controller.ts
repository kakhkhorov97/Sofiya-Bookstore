import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  AdminBookListQuery,
  AdminMemberListQuery,
  AdminOrderListQuery,
  AiDraftInput,
  BookInput,
  MemberStatusInput,
} from '@sofiya/shared';
import type {
  AdminBook,
  AdminMember,
  AdminOrder,
  AdminOverview,
  AiDraft,
  BookInputParsed,
  IndexJobState,
  Page,
} from '@sofiya/shared';
import { z } from 'zod';
import { IndexJobService } from '../ai/index-job.service';
import { AdminGuard, AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';
import { MAX_UPLOAD_BYTES } from '../storage/images';
import { AdminBooksService } from './admin-books.service';
import { AdminPeopleService } from './admin-people.service';

const Id = new ZodPipe(z.string().uuid());

// Memory upload, one file, size-capped before it reaches our code. The
// image itself is validated by decoding it (see storage/images.ts).
const coverUpload = FileInterceptor('cover', {
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 10 },
});

function requireFile(file: Express.Multer.File | undefined): Buffer {
  if (!file?.buffer?.length)
    throw new BadRequestException('Choose an image to upload.');
  return file.buffer;
}

@Controller('admin')
@UseGuards(AuthGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly books: AdminBooksService,
    private readonly people: AdminPeopleService,
    private readonly index: IndexJobService,
  ) {}

  @Get('overview')
  overview(): Promise<AdminOverview> {
    return this.people.overview();
  }

  // ---- Books -------------------------------------------------------------

  @Get('books')
  listBooks(
    @Query(new ZodPipe(AdminBookListQuery)) query: AdminBookListQuery,
  ): Promise<Page<AdminBook>> {
    return this.books.list(query);
  }

  @Get('books/:id')
  getBook(@Param('id', Id) id: string): Promise<AdminBook> {
    return this.books.get(id);
  }

  @Post('books')
  createBook(
    @Body(new ZodPipe(BookInput)) input: BookInputParsed,
  ): Promise<AdminBook> {
    return this.books.create(input);
  }

  @Put('books/:id')
  updateBook(
    @Param('id', Id) id: string,
    @Body(new ZodPipe(BookInput)) input: BookInputParsed,
  ): Promise<AdminBook> {
    return this.books.update(id, input);
  }

  @Delete('books/:id')
  @HttpCode(204)
  async deleteBook(@Param('id', Id) id: string): Promise<void> {
    await this.books.remove(id);
  }

  @Put('books/:id/cover')
  @UseInterceptors(coverUpload)
  setCover(
    @Param('id', Id) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<AdminBook> {
    return this.books.setCover(id, requireFile(file));
  }

  @Delete('books/:id/cover')
  removeCover(@Param('id', Id) id: string): Promise<AdminBook> {
    return this.books.removeCover(id);
  }

  // Multipart: title, author, notes, and an optional cover image.
  @Post('books/ai-draft')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(coverUpload)
  draft(
    @Body(new ZodPipe(AiDraftInput)) input: AiDraftInput,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<AiDraft> {
    return this.books.draft(
      input,
      file?.buffer?.length ? file.buffer : undefined,
    );
  }

  // ---- AI index ----------------------------------------------------------

  @Get('ai/index')
  indexStatus(): IndexJobState {
    return this.index.status();
  }

  @Post('ai/index')
  @HttpCode(202)
  reindex(): { started: boolean } {
    return { started: this.index.trigger() };
  }

  // ---- Orders and members -----------------------------------------------

  @Get('orders/detailed')
  orders(
    @Query(new ZodPipe(AdminOrderListQuery)) query: AdminOrderListQuery,
  ): Promise<Page<AdminOrder>> {
    return this.people.orders(query);
  }

  @Get('members')
  members(
    @Query(new ZodPipe(AdminMemberListQuery)) query: AdminMemberListQuery,
  ): Promise<Page<AdminMember>> {
    return this.people.members(query);
  }

  @Patch('members/:id/status')
  @HttpCode(204)
  async setMemberStatus(
    @CurrentUser() admin: SessionUser,
    @Param('id', Id) id: string,
    @Body(new ZodPipe(MemberStatusInput)) input: MemberStatusInput,
  ): Promise<void> {
    await this.people.setMemberStatus(admin.id, id, input);
  }
}
