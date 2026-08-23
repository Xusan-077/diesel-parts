import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';
import { QueryMovementsDto } from '../inventory/dto/query-movements.dto';
import { AdjustInventoryDto } from '../inventory/dto/adjust-inventory.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_UP } from '../common/roles';

/** Thin façade over InventoryService, which owns the transactional stock math — see InventoryModule. */
@Controller('stock-movements')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_UP)
export class StockMovementsController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  findAll(@Query() query: QueryMovementsDto) {
    return this.inventory.movements({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      productId: query.productId,
      warehouseId: query.warehouseId,
    });
  }

  @Post()
  create(@Body() dto: AdjustInventoryDto, @CurrentUser('id') userId: string) {
    return this.inventory.adjust(dto, userId);
  }
}
