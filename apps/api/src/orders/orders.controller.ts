import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  AdminOrderStatusInput,
  CreateOrderInput,
  OrderListQuery,
  OrderView,
  Page,
  TossConfirmInput,
} from '@sofiya/shared';
import type { Response } from 'express';
import { z } from 'zod';
import {
  AdminGuard,
  AuthGuard,
  CurrentUser,
  VerifiedEmailGuard,
} from '../auth/auth.guard';
import type { SessionUser } from '../auth/auth.guard';
import { ZodPipe } from '../common/zod.pipe';
import { OrdersService } from './orders.service';

const OrderId = new ZodPipe(z.guid());

@Controller('orders')
@UseGuards(AuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  // 201 for a new order, 200 when the same idempotency key is replayed.
  @Post()
  @UseGuards(VerifiedEmailGuard)
  async create(
    @CurrentUser() user: SessionUser,
    @Body(new ZodPipe(CreateOrderInput)) input: CreateOrderInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<OrderView> {
    const { order, created } = await this.orders.create(user.id, input);
    res.status(created ? 201 : 200);
    return order;
  }

  @Get()
  list(
    @CurrentUser() user: SessionUser,
    @Query(new ZodPipe(OrderListQuery)) query: OrderListQuery,
  ): Promise<Page<OrderView>> {
    return this.orders.list(query, user.id);
  }

  @Get(':id')
  get(
    @CurrentUser() user: SessionUser,
    @Param('id', OrderId) id: string,
  ): Promise<OrderView> {
    return this.orders.getForUser(user.id, id);
  }

  @Post(':id/payments/toss/confirm')
  @HttpCode(200)
  confirmTossPayment(
    @CurrentUser() user: SessionUser,
    @Param('id', OrderId) id: string,
    @Body(new ZodPipe(TossConfirmInput)) input: TossConfirmInput,
  ): Promise<OrderView> {
    return this.orders.confirmCardPayment(user.id, id, input);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  cancel(
    @CurrentUser() user: SessionUser,
    @Param('id', OrderId) id: string,
  ): Promise<OrderView> {
    return this.orders.cancelByCustomer(user.id, id);
  }
}

@Controller('admin/orders')
@UseGuards(AuthGuard, AdminGuard)
export class AdminOrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  list(
    @Query(new ZodPipe(OrderListQuery)) query: OrderListQuery,
  ): Promise<Page<OrderView>> {
    return this.orders.list(query);
  }

  @Patch(':id/status')
  setStatus(
    @Param('id', OrderId) id: string,
    @Body(new ZodPipe(AdminOrderStatusInput)) input: AdminOrderStatusInput,
  ): Promise<OrderView> {
    return this.orders.setStatusByAdmin(id, input);
  }
}
