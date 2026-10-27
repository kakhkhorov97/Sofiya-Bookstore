import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AiModule } from './ai/ai.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { CommunityModule } from './community/community.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { PaymentsModule } from './payments/payments.module';
import { OrdersModule } from './orders/orders.module';
import { StorageModule } from './storage/storage.module';

@Module({
  imports: [
    DbModule,
    StorageModule,
    AiModule,
    BooksModule,
    AuthModule,
    PaymentsModule,
    OrdersModule,
    CommunityModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
