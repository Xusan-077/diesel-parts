import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { QueryInventoryDto } from './dto/query-inventory.dto';
import { QueryMovementsDto } from './dto/query-movements.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SELLER_UP } from '../common/roles';

@Controller('seller/inventory')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerInventoryController {
  constructor(private readonly inventory: InventoryService) {}

  @Get()
  findAll(@Query() query: QueryInventoryDto) {
    return this.inventory.findAll(query);
  }

  @Get('low-stock')
  lowStock(@Query() query: QueryInventoryDto) {
    return this.inventory.lowStock(query);
  }

  @Get('movements')
  movements(@Query() query: QueryMovementsDto) {
    return this.inventory.movements({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      productId: query.productId,
      warehouseId: query.warehouseId,
    });
  }
}
