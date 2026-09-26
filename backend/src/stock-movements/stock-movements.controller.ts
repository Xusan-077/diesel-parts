import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { QueryMovementsDto } from '../inventory/dto/query-movements.dto';
import { AdjustInventoryDto } from '../inventory/dto/adjust-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

/** Thin façade over InventoryService, which owns the transactional stock math — see InventoryModule. */
@Controller('stock-movements')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StockMovementsController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  @RequirePermission('warehouse:read')
  findAll(@Query() query: QueryMovementsDto) {
    return this.inventory.movements({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      productId: query.productId,
      warehouseId: query.warehouseId,
    });
  }

  @Post()
  @RequirePermission('warehouse:create')
  create(@Body() dto: AdjustInventoryDto, @CurrentUser('id') userId: string) {
    return this.inventory.adjust(dto, userId);
  }
}
