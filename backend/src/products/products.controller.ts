import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MANAGER_UP } from '../common/roles';

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
}
