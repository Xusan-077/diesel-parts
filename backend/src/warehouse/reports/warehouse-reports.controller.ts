import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { SELLER_UP } from '../../common/roles';
import { WarehouseReportsService } from './warehouse-reports.service';
import { QueryStockReportDto } from './dto/query-stock-report.dto';
import { QueryMovementsReportDto } from './dto/query-movements-report.dto';

/** Read-only warehouse reports. `SELLER_UP` — warehouse staff read these. */
@Controller('warehouse/reports')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
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
