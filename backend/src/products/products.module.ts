import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { AiModule } from '../ai/ai.module';
import { ProductsController } from './products.controller';
import { SellerProductsController } from './seller-products.controller';
import { PublicProductsController } from './public-products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [AuditModule, AiModule],
  controllers: [
    ProductsController,
    SellerProductsController,
    PublicProductsController,
  ],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
