import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SELLER_UP } from '../common/roles';

/** purchase_price is stripped by ProductsService.toSellerView before this ever serializes a response. */
@Controller('seller/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...SELLER_UP)
export class SellerProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllSeller(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOneSeller(id);
  }

  @Get(':id/stock')
  stock(@Param('id') id: string) {
    return this.products.stock(id);
  }
}
