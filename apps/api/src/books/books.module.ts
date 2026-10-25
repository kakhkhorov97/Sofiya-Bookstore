import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { BooksController } from './books.controller';
import { BooksService } from './books.service';

@Module({
  imports: [AiModule],
  controllers: [BooksController],
  providers: [BooksService],
  exports: [BooksService],
})
export class BooksModule {}
