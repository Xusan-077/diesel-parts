import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString } from 'class-validator';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

class QueryPaymentsDto {
  @IsString()
  orderId: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @RequirePermission('orders:read')
  findByOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.payments.findByOrder(actor, query.orderId);
  }

  @Get(':id')
  @RequirePermission('orders:read')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.findOne(actor, id);
  }

  @Post()
  @RequirePermission('orders:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(actor, dto);
  }
}
