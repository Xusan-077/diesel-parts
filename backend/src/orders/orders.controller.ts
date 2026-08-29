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
import { QueryOrderDto } from './dto/query-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { RequestDiscountDto } from './dto/request-discount.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get()
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryOrderDto,
  ) {
    return this.orders.findAll(actor, query);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.findOne(actor, id);
  }

  @Post()
  create(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreateOrderDto) {
    return this.orders.create(actor, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orders.updateStatus(actor, id, dto.status);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.orders.cancel(actor, id);
  }

  @Post(':id/discount-request')
  requestDiscount(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RequestDiscountDto,
  ) {
    return this.orders.requestDiscount(actor, id, dto);
  }
}
