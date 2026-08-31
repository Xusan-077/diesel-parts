import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import {
  PeriodQueryDto,
  PeriodLimitQueryDto,
  LimitQueryDto,
} from './dto/period-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DIRECTOR_UP } from '../common/roles';

/** The director analytics screen — see AnalyticsService's own doc comment for why this is separate from reports/dashboard. */
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DIRECTOR_UP)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('sales-summary')
  salesSummary(@Query() query: PeriodQueryDto) {
    return this.analytics.salesSummary(query);
  }

  @Get('revenue-series')
  revenueSeries(@Query() query: PeriodQueryDto) {
    return this.analytics.revenueSeries(query);
  }

  @Get('seller-performance')
  sellerPerformance(@Query() query: PeriodQueryDto) {
    return this.analytics.sellerPerformance(query);
  }

  @Get('order-status-breakdown')
  orderStatusBreakdown(@Query() query: PeriodQueryDto) {
    return this.analytics.orderStatusBreakdown(query);
  }

  @Get('recent-orders')
  recentOrders(@Query() query: LimitQueryDto) {
    return this.analytics.recentOrders(query.limit ?? 6);
  }

  @Get('dashboard-counts')
  dashboardCounts() {
    return this.analytics.dashboardCounts();
  }

  @Get('sales-series')
  salesSeries(@Query() query: PeriodQueryDto) {
    return this.analytics.salesSeries(query);
  }

  @Get('product-movement')
  productMovement(@Query() query: PeriodLimitQueryDto) {
    return this.analytics.productMovement(query, query.limit ?? 10);
  }

  @Get('seller-scorecards')
  sellerScorecards(@Query() query: PeriodQueryDto) {
    return this.analytics.sellerScorecards(query);
  }

  @Get('customer-analytics')
  customerAnalytics(@Query() query: PeriodLimitQueryDto) {
    return this.analytics.customerAnalytics(query, query.limit ?? 10);
  }
}
