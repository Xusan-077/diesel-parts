import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';

/** purchase_price is stripped by ProductsService.toSellerView before this ever serializes a response. */
@Controller('seller/products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermission('products:read')
export class SellerProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllSeller(query);
  }

  @Get('barcode/:code')
  findByBarcode(@Param('code') code: string) {
    return this.products.findByBarcodeSeller(code);
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
