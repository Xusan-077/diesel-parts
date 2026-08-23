import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { StockMovementsController } from './stock-movements.controller';

@Module({
  imports: [InventoryModule],
  controllers: [StockMovementsController],
})
export class StockMovementsModule {}
