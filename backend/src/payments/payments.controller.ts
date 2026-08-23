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
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

class QueryPaymentsDto {
  @IsString()
  orderId: string;
}

@Controller('payments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  findByOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryPaymentsDto,
  ) {
    return this.payments.findByOrder(actor, query.orderId);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.payments.findOne(actor, id);
  }

  @Post()
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.payments.create(actor, dto);
  }
}
