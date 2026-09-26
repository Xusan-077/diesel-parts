import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RequestDiscountDto } from './dto/request-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/orders')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  @RequirePermission('orders:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryOrderDto,
  ) {
    return this.orders.findAll(actor, query);
  }

  @Get(':id')
  @RequirePermission('orders:read')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.findOne(actor, id);
  }

  @Post()
  @RequirePermission('orders:create')
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto);
  }

  @Patch(':id/status')
  @RequirePermission('orders:update')
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(actor, id, dto.status);
  }

  @Patch(':id')
  @RequirePermission('orders:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.orders.update(actor, id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('orders:update')
  cancel(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.cancel(actor, id);
  }

  @Post(':id/discount-request')
  @RequirePermission('discounts:create')
  requestDiscount(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequestDiscountDto,
  ) {
    return this.orders.requestDiscount(actor, id, dto);
  }
}
