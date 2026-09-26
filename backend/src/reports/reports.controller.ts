import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeDto } from '../dashboard/dto/date-range.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('analytics:read')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('sales-summary')
  salesSummary(@Query() range: DateRangeDto) {
    return this.reports.salesSummary(range);
  }

  @Get('inventory-status')
  inventoryStatus() {
    return this.reports.inventoryStatus();
  }
}
