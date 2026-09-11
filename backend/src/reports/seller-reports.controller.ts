import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeDto } from '../dashboard/dto/date-range.dto';
import { TopProductsQueryDto } from './dto/top-products-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { SELLER_UP } from '../common/roles';
import type { AuthenticatedUser } from '../auth/auth.types';

@Controller('seller/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('daily-sales')
  dailySales(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() range: DateRangeDto,
  ) {
    return this.reports.sellerDailySales(actor, range);
  }

  @Get('top-products')
  topProducts(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: TopProductsQueryDto,
  ) {
    return this.reports.sellerTopProducts(actor, query, query.limit ?? 10);
  }
}
