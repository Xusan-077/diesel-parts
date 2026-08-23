import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { IsString } from 'class-validator';
import { OrderItemsService } from './order-items.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

class QueryOrderItemsDto {
  @IsString()
  orderId: string;
}

@Controller('order-items')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class OrderItemsController {
  constructor(private readonly orderItems: OrderItemsService) {}

  @Get()
  findByOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryOrderItemsDto,
  ) {
    return this.orderItems.findByOrder(actor, query.orderId);
  }
}
