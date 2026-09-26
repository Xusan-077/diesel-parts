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
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * The catalog CRUD surface. Both DIRECTOR and SELLER may create/read/update
 * a product here (spec: "products — CRUD" for SELLER); the cost side
 * (`purchasePrice`) stays DIRECTOR-only regardless — `findAll`/`findOne`
 * route a SELLER through the same cost-stripping view `/seller/products`
 * already used (`findAllSeller`/`findOneSeller`), and `create`/`update`
 * strip `purchasePrice` off a SELLER's body before it ever reaches the
 * service, rather than letting them set or read it here.
 */
@Controller('products')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('products:read')
  findAll(
    @CurrentUser() actor: AuthenticatedUser,
    @Query() query: QueryProductDto,
  ) {
    return actor.role === 'SELLER'
      ? this.products.findAllSeller(query)
      : this.products.findAllAdmin(query);
  }

  /**
   * Bulk import/export carry `purchasePrice` in every row — kept
   * DIRECTOR-only (reusing the `products:delete` grant, the one products
   * action SELLER doesn't have) rather than opened alongside the rest of
   * CRUD, since a CSV is the one surface here that can't strip a single
   * field per-row the way the JSON routes below do.
   */
  @Post('import')
  @RequirePermission('products:delete')
  import(@CurrentUser('id') actorId: string, @Body() dto: ImportProductsDto) {
    return this.products.importCsv(dto.csv, actorId);
  }

  /**
   * The order form's lookup (root's `product-lookup-repository.ts`) — open
   * to both roles, same as the rest of `products:read`. The response never
   * carries purchasePrice, so this leaks nothing either way.
   */
  @Get('search')
  @RequirePermission('products:read')
  search(@Query() query: SearchProductDto) {
    return this.products.search(query.q);
  }

  @Get('export')
  @RequirePermission('products:delete')
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
  @RequirePermission('products:read')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return actor.role === 'SELLER'
      ? this.products.findOneSeller(id)
      : this.products.findOneAdmin(id);
  }

  /** Whether DELETE would succeed, and the blockers if not. Same permission as DELETE. */
  @Get(':id/delete-check')
  @RequirePermission('products:delete')
  deleteCheck(@Param('id') id: string) {
    return this.products.deleteCheck(id);
  }

  @Get(':id/stock')
  @RequirePermission('products:read')
  stock(@Param('id') id: string) {
    return this.products.stock(id);
  }

  @Post()
  @RequirePermission('products:create')
  create(
    @CurrentUser() actor: AuthenticatedUser,
    @Body() dto: CreateProductDto,
  ) {
    return this.products.create(withoutSellerCost(actor, dto), actor.id);
  }

  @Patch(':id')
  @RequirePermission('products:update')
  update(
    @CurrentUser() actor: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.products.update(id, withoutSellerCost(actor, dto), actor.id);
  }

  /**
   * Permanent delete — director-only (`products:delete`), narrower than the
   * rest of this controller's `products:create`/`read`/`update`, so a SELLER
   * gets 403 from PermissionsGuard before the service runs. Refused with 409
   * when the product has sales/warehouse history.
   */
  @Delete(':id')
  @RequirePermission('products:delete')
  hardDelete(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.products.hardDelete(id, actorId);
  }

  /**
   * Soft delete (isActive=false). This was DELETE /products/:id's behaviour
   * before that route became a hard delete; kept here so the retire action
   * stays reachable for both roles.
   */
  @Patch(':id/archive')
  @RequirePermission('products:update')
  archive(@CurrentUser('id') actorId: string, @Param('id') id: string) {
    return this.products.archive(id, actorId);
  }

  @Patch(':id/image')
  @RequirePermission('products:update')
  setImage(
    @CurrentUser('id') actorId: string,
    @Param('id') id: string,
    @Body() dto: SetProductImageDto,
  ) {
    return this.products.setImage(id, dto.imageUrl, actorId);
  }
}

/** A SELLER's create/update body never sets cost — silently dropped, not rejected. */
function withoutSellerCost<T extends { purchasePrice?: number }>(
  actor: AuthenticatedUser,
  dto: T,
): T {
  if (actor.role !== 'SELLER') return dto;
  const rest: Partial<T> = { ...dto };
  delete rest.purchasePrice;
  return rest as T;
}
