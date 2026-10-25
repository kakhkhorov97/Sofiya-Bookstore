import { Module } from '@nestjs/common';
import { BooksModule } from './books/books.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [DbModule, BooksModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
