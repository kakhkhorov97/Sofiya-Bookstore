import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { DbModule } from './db/db.module';
import { HealthController } from './health/health.controller';
import { OrdersModule } from './orders/orders.module';

@Module({
  imports: [DbModule, BooksModule, AuthModule, OrdersModule],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
