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
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { MANAGER_UP, SELLER_UP } from '../../common/roles';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarehouseProductsController {
  constructor(private readonly products: WarehouseProductsService) {}

  @Get()
  @Roles(...SELLER_UP)
  list(@Query() query: QueryWarehouseProductsDto) {
    return this.products.list(query);
  }

  @Get(':id')
  @Roles(...SELLER_UP)
  findOne(@Param('id') id: string, @Query('warehouseId') warehouseId?: string) {
    return this.products.findOne(id, warehouseId);
  }

  @Get(':id/movements')
  @Roles(...SELLER_UP)
  movements(@Param('id') id: string, @Query() query: QueryProductMovementsDto) {
    return this.products.movements(id, query);
  }

  @Post()
  @Roles(...MANAGER_UP)
  create(
    @CurrentUser('id') actorId: string,
    @Body() dto: CreateWarehouseProductDto,
  ) {
    return this.products.create(dto, actorId);
  }

  @Patch(':id')
  @Roles(...MANAGER_UP)
  update(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: UpdateWarehouseProductDto,
  ) {
    return this.products.update(id, dto, actorId);
  }
}
