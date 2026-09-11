import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CashierService } from './cashier.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/cashier')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class CashierController {
  constructor(private readonly cashier: CashierService) {}

  @Get('shift/current')
  current(@CurrentUser() actor: AuthenticatedUser) {
    return this.cashier.current(actor);
  }

  @Post('shift/open')
  open(@CurrentUser() actor: AuthenticatedUser, @Body() dto: OpenShiftDto) {
    return this.cashier.open(actor, dto);
  }

  @Post('shift/close')
  close(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CloseShiftDto) {
    return this.cashier.close(actor, dto);
  }
}
