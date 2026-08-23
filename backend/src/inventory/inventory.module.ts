import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { SellerInventoryController } from './seller-inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  controllers: [InventoryController, SellerInventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
