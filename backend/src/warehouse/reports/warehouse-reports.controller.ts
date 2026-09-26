import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { WarehouseReportsService } from './warehouse-reports.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';
import { QueryMovementsReportDto } from './dto/query-movements-report.dto';

/** Read-only warehouse reports — both roles read these. */
@Controller('warehouse/reports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('warehouse:read')
export class WarehouseReportsController {
  constructor(private readonly reports: WarehouseReportsService) {}

  @Get('stock')
  stock(@Query() query: QueryStockReportDto) {
    return this.reports.stock(query);
  }

  @Get('low-stock')
  lowStock(@Query() query: QueryStockReportDto) {
    return this.reports.lowStock(query);
  }

  @Get('movements')
  movements(@Query() query: QueryMovementsReportDto) {
    return this.reports.movements(query);
  }
}
