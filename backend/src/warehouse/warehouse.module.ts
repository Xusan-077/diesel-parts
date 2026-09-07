import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { WarehouseProductsController } from './products/warehouse-products.controller';
import { WarehouseProductsService } from './products/warehouse-products.service';

/**
 * Phase 1 of the warehouse (ombor) module — goods receipts and the
 * warehouse-flavoured product view. Sits alongside the existing `warehouses`,
 * `inventory` and `stock-movements` modules and reuses their services rather
 * than duplicating the stock math.
 */
@Module({
  imports: [ProductsModule],
  controllers: [WarehouseProductsController],
  providers: [WarehouseProductsService],
})
export class WarehouseModule {}
