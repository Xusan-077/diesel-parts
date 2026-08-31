import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { QueryProductStatsDto } from './dto/query-product-stats.dto';

/**
 * Unauthenticated storefront catalog reads. Only active products, never cost
 * data (toSellerView strips purchasePrice). Kept separate from
 * ProductsController so the class-level JwtAuthGuard there stays untouched.
 *
 * `slugs` and `stats` are declared before the `:slug` catch-all so neither
 * literal path is swallowed by it.
 */
@Controller('catalog/products')
export class PublicProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllPublic(query);
  }

  @Get('slugs')
  slugs() {
    return this.products.findActiveSlugs();
  }

  @Get('stats')
  stats(@Query() query: QueryProductStatsDto) {
    return this.products.productStats(
      query.ids.split(',').map((id) => id.trim()),
    );
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.products.findOnePublic(slug);
  }
}
