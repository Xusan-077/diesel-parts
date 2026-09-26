import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('invoices')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get('order/:orderId')
  @RequirePermission('orders:read')
  findByOrder(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('orderId') orderId: string,
  ) {
    return this.invoices.findByOrder(actor, orderId);
  }

  @Post()
  @RequirePermission('orders:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoices.create(actor, dto);
  }
}
