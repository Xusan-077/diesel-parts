import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DateRangeDto } from './dto/date-range.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  summary(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboard.summary(actor);
  }

  @Get('sales')
  sales(@CurrentUser() actor: AuthenticatedUser, @Query() range: DateRangeDto) {
    return this.dashboard.salesChart(actor, range);
  }

  @Get('orders')
  orders(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() range: DateRangeDto,
  ) {
    return this.dashboard.ordersChart(actor, range);
  }

  @Get('top-products')
  topProducts(@CurrentUser() actor: AuthenticatedUser) {
    return this.dashboard.topProducts(actor);
  }
}
