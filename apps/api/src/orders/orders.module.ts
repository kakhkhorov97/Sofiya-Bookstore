import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminOrdersController, OrdersController } from './orders.controller';
import { OrderEmailsService } from './order-emails.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [AuthModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService, OrderEmailsService],
})
export class OrdersModule {}
