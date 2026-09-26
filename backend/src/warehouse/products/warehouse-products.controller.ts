import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermission } from '../../common/decorators/require-permission.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WarehouseProductsService } from './warehouse-products.service';
import {
  CreateWarehouseProductDto,
  UpdateWarehouseProductDto,
} from './dto/create-warehouse-product.dto';
import { QueryWarehouseProductsDto } from './dto/query-warehouse-products.dto';
import { QueryProductMovementsDto } from './dto/query-product-movements.dto';

/**
 * Warehouse-flavoured product view: per-warehouse stock, cost columns and the
 * stock ledger. Reads are `SELLER_UP` (warehouse staff see cost here — a
 * deliberate departure from the storefront seller panel); writes are
 * `MANAGER_UP` and delegate to `ProductsService` so the catalog and the
 * warehouse share one write path and one audit trail.
 */
@Controller('warehouse/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WarehouseProductsController {
  constructor(private readonly products: WarehouseProductsService) {}

  @Get()
  @RequirePermission('warehouse:read')
  list(@Query() query: QueryWarehouseProductsDto) {
    return this.products.list(query);
  }

  @Get(':id')
  @RequirePermission('warehouse:read')
  findOne(@Param('id') id: string, @Query('warehouseId') warehouseId?: string) {
    return this.products.findOne(id, warehouseId);
  }

  @Get(':id/movements')
  @RequirePermission('warehouse:read')
  movements(@Param('id') id: string, @Query() query: QueryProductMovementsDto) {
    return this.products.movements(id, query);
  }

  @Post()
  @RequirePermission('warehouse:create')
  create(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateWarehouseProductDto,
  ) {
    return this.products.create(dto, actorId);
  }

  @Patch(':id')
  @RequirePermission('warehouse:update')
  update(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateWarehouseProductDto,
  ) {
    return this.products.update(id, dto, actorId);
  }
}
