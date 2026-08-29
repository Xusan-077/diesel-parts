import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';

/**
 * Unauthenticated storefront catalog reads. Only active products, never cost
 * data (toSellerView strips purchasePrice). Kept separate from
 * ProductsController so the class-level JwtAuthGuard there stays untouched.
 */
@Controller('catalog/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllPublic(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findOnePublic(slug);
  }
}
