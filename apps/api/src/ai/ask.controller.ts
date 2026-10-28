import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AskInput } from '@sofiya/shared';
import type { AiStatus, AskEvent } from '@sofiya/shared';
import type { Request, Response } from 'express';
import { ZodPipe } from '../common/zod.pipe';
import { loadEnv } from '../config/env';
import { AskService } from './ask.service';
import { RetrievalService } from './retrieval.service';

const env = loadEnv();

@Controller()
export class AskController {
  constructor(
    private readonly ask: AskService,
    private readonly retrieval: RetrievalService,
  ) {}

  @Get('ai/status')
  async status(): Promise<AiStatus> {
    return {
      enabled: this.retrieval.enabled,
      indexedBooks: this.retrieval.enabled
        ? await this.retrieval.indexedCount()
        : 0,
    };
  }

  // Server-sent events over POST: sources, then answer text, then done.
  @Post('ask')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: env.AI_RATE_LIMIT, ttl: 60_000 } })
  async stream(
    @Body(new ZodPipe(AskInput)) input: AskInput,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.ask.checkAvailable();

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const abort = new AbortController();
    req.on('close', () => abort.abort());
    const send = (event: AskEvent) => {
      if (!res.writableEnded) res.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      for await (const event of this.ask.answer(input, abort.signal)) {
        if (abort.signal.aborted) break;
        send(event);
      }
    } catch {
      send({
        type: 'error',
        message: 'Something went wrong. Please try again.',
      });
    } finally {
      res.end();
    }
  }
}
