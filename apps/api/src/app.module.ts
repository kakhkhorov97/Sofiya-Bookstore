import { Module } from '@nestjs/common';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CommunityModule } from './community/community.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [
    DbModule,
    AiModule,
    BooksModule,
    AuthModule,
    OrdersModule,
    CommunityModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
