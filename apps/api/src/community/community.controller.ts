import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { NewsletterInput, ReviewInput } from '@sofiya/shared';
import type {
  BookSummary,
  MyReviewsResponse,
  ReviewsResponse,
  ReviewView,
} from '@sofiya/shared';
import type { Response } from 'express';
import { z } from 'zod';
import {
  AuthGuard,
  CurrentUser,
  OptionalAuthGuard,
  OptionalUser,
  VerifiedEmailGuard,
} from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';
import { CommunityService } from './community.service';

const BookId = new ZodPipe(z.guid());
const Slug = new ZodPipe(
  z
    .string()
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
);

@Controller()
export class CommunityController {
  constructor(private readonly community: CommunityService) {}

  @Get('wishlist')
  @UseGuards(AuthGuard)
  wishlist(@CurrentUser() user: SessionUser): Promise<BookSummary[]> {
    return this.community.wishlist(user.id);
  }

  @Get('wishlist/ids')
  @UseGuards(AuthGuard)
  wishlistIds(@CurrentUser() user: SessionUser): Promise<string[]> {
    return this.community.wishlistIds(user.id);
  }

  @Put('wishlist/:bookId')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async addToWishlist(
    @CurrentUser() user: SessionUser,
    @Param('bookId', BookId) bookId: string,
  ): Promise<void> {
    await this.community.addToWishlist(user.id, bookId);
  }

  @Delete('wishlist/:bookId')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async removeFromWishlist(
    @CurrentUser() user: SessionUser,
    @Param('bookId', BookId) bookId: string,
  ): Promise<void> {
    await this.community.removeFromWishlist(user.id, bookId);
  }

  @Get('me/reviews')
  @UseGuards(AuthGuard)
  myReviews(@CurrentUser() user: SessionUser): Promise<MyReviewsResponse> {
    return this.community.myReviews(user.id);
  }

  @Get('books/:slug/reviews')
  @UseGuards(OptionalAuthGuard)
  reviews(
    @Param('slug', Slug) slug: string,
    @OptionalUser() user: SessionUser | null,
  ): Promise<ReviewsResponse> {
    return this.community.reviews(slug, user?.id ?? null);
  }

  @Put('books/:slug/reviews')
  @UseGuards(AuthGuard, VerifiedEmailGuard)
  saveReview(
    @CurrentUser() user: SessionUser,
    @Param('slug', Slug) slug: string,
    @Body(new ZodPipe(ReviewInput)) input: ReviewInput,
  ): Promise<ReviewView> {
    return this.community.saveReview(user.id, slug, input);
  }

  @Delete('books/:slug/reviews')
  @HttpCode(204)
  @UseGuards(AuthGuard)
  async deleteReview(
    @CurrentUser() user: SessionUser,
    @Param('slug', Slug) slug: string,
  ): Promise<void> {
    await this.community.deleteReview(user.id, slug);
  }

  // 201 for a new address, 200 when it was already on the list.
  @Post('newsletter')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async subscribe(
    @Body(new ZodPipe(NewsletterInput)) input: NewsletterInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ subscribed: true }> {
    const created = await this.community.subscribe(input);
    res.status(created ? 201 : 200);
    return { subscribed: true };
  }
}
