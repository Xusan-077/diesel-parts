import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { DateRangeDto } from '../dashboard/dto/date-range.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { DIRECTOR_UP } from '../common/roles';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DIRECTOR_UP)
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
