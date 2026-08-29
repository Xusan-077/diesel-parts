import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ImportProductsDto } from './dto/import-products.dto';
import { SearchProductDto } from './dto/search-product.dto';
import { SetProductImageDto } from './dto/set-product-image.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ALL_ROLES, MANAGER_UP } from '../common/roles';

/**
 * Full admin view (includes purchase_price). Restricted to MANAGER_UP so a
 * SELLER can never reach cost data through this route — they use
 * /seller/products instead, which strips it at serialization.
 */
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...MANAGER_UP)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: QueryProductDto) {
    return this.products.findAllAdmin(query);
  }

  @Post('import')
  import(@CurrentUser('id') actorId: string, @Body() dto: ImportProductsDto) {
    return this.products.importCsv(dto.csv, actorId);
  }

  /**
   * Widened from the class's MANAGER_UP: this is the order form's lookup
   * (root's `product-lookup-repository.ts`), and raising an order is a
   * seller's job, not just a manager's. The response never carries
   * purchasePrice, so opening it to every staff role leaks nothing.
   */
  @Get('search')
  @Roles(...ALL_ROLES)
  search(@Query() query: SearchProductDto) {
    return this.products.search(query.q);
  }

  @Get('export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  async export(@Res({ passthrough: true }) res: Response): Promise<string> {
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="diesel-parts-katalog-${today}.csv"`,
    );
    return this.products.exportCsv();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOneAdmin(id);
  }

  @Get(':id/stock')
  stock(@Param('id') id: string) {
    return this.products.stock(id);
  }

  @Post()
  create(@CurrentUser('id') actorId: string, @Body() dto: CreateProductDto) {
    return this.products.create(dto, actorId);
  }

  @Patch(':id')
  update(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, dto, actorId);
  }

  @Delete(':id')
  remove(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.products.remove(id, actorId);
  }

  @Patch(':id/image')
  setImage(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: SetProductImageDto,
  ) {
    return this.products.setImage(id, dto.imageUrl, actorId);
  }
}
