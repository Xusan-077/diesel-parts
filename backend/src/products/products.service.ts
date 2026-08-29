import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction, Prisma } from '../../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { ImportProductRowDto } from './dto/import-products.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { deriveStockStatus } from './stock-status';
import {
  readProductCsv,
  toCsv,
  type CsvRowError,
  type ProductCsvRow,
} from './product-csv';

/**
 * Imported catalog stock lands here — the same warehouse the web_dev→erp data
 * migration uses (see Global Constraints in the consolidation plan), so a
 * product's `stock` column keeps meaning once stock is Inventory-derived.
 */
const CATALOG_WAREHOUSE_NAME = "Katalog (ko'chirilgan)";

export interface ImportProductsResult {
  success: boolean;
  created: number;
  updated: number;
  errors: CsvRowError[];
}

const ADMIN_INCLUDE = {
  category: { select: { id: true, nameUz: true, nameRu: true, nameEn: true } },
  brand: { select: { id: true, name: true } },
  inventories: {
    select: { quantity: true, reservedQuantity: true, warehouseId: true },
  },
} as const;

/** Never returned to a SELLER: cost data the frontend/API must not leak to them. */
const SELLER_HIDDEN_FIELDS = ['purchasePrice'] as const;

/**
 * The shape written to the audit trail — enough to see what changed. Mirrors
 * root's `product-write-repository.ts` `auditSnapshot`, minus `stock`/
 * `stockStatus` (computed from `Inventory` here, not stored on the row).
 */
function auditSnapshot(row: {
  sku: string;
  slug: string;
  nameUz: string;
  price: unknown;
  minStock: number;
  isActive: boolean;
}) {
  return {
    sku: row.sku,
    slug: row.slug,
    name: row.nameUz,
    price: row.price === null ? null : Number(row.price),
    minStock: row.minStock,
    isActive: row.isActive,
  };
}

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private withStock<
    T extends {
      inventories: { quantity: number; reservedQuantity: number }[];
      minStock: number;
    },
  >(product: T) {
    const quantity = product.inventories.reduce(
      (sum, inv) => sum + inv.quantity,
      0,
    );
    const reservedQuantity = product.inventories.reduce(
      (sum, inv) => sum + inv.reservedQuantity,
      0,
    );
    const availableQuantity = quantity - reservedQuantity;
    const stockStatus = deriveStockStatus(availableQuantity, product.minStock);
    const rest: Partial<T> = { ...product };
    delete rest.inventories;
    return {
      ...rest,
      quantity,
      reservedQuantity,
      availableQuantity,
      stockStatus,
    };
  }

  private async queryWithComputedStock(
    query: QueryProductDto,
    options: { publicOnly?: boolean } = {},
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const where: Record<string, unknown> = {};
    if (options.publicOnly) where.isActive = true;
    if (query.search) {
      where.OR = [
        { nameUz: { contains: query.search, mode: 'insensitive' } },
        { nameRu: { contains: query.search, mode: 'insensitive' } },
        { nameEn: { contains: query.search, mode: 'insensitive' } },
        { sku: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.ids) {
      where.id = { in: query.ids.split(',').map((id) => id.trim()) };
    }

    const all = await this.prisma.product.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: query.sort === 'id' ? { id: 'asc' } : { createdAt: 'desc' },
    });

    let withStock = all.map((product) => this.withStock(product));
    if (query.stockStatus) {
      withStock = withStock.filter(
        (product) => product.stockStatus === query.stockStatus,
      );
    }
    // Not a column: sorted here, over whatever the DB already ordered by id/createdAt.
    // Ascending — every admin caller of this (the stock-overview page, the
    // product list's own "stock" sort) wants the shortest stock first.
    if (query.sort === 'stock') {
      withStock = [...withStock].sort(
        (a, b) => a.availableQuantity - b.availableQuantity,
      );
    }

    const total = withStock.length;
    const data = withStock.slice(
      (page - 1) * limit,
      (page - 1) * limit + limit,
    );
    return { data, meta: paginationMeta(page, limit, total) };
  }

  async findAllAdmin(query: QueryProductDto) {
    return this.queryWithComputedStock(query);
  }

  async findAllSeller(query: QueryProductDto) {
    const result = await this.queryWithComputedStock(query);
    return {
      ...result,
      data: result.data.map((product) => this.toSellerView(product)),
    };
  }

  async findAllPublic(query: QueryProductDto) {
    const result = await this.queryWithComputedStock(query, {
      publicOnly: true,
    });
    return {
      ...result,
      data: result.data.map((product) => this.toSellerView(product)),
    };
  }

  async findOnePublic(slug: string) {
    const product = await this.prisma.product.findUnique({
      where: { slug },
      include: ADMIN_INCLUDE,
    });
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    return this.toSellerView(this.withStock(product));
  }

  async findOneAdmin(id: string) {
    return this.getWithStockOrThrow(id);
  }

  async findOneSeller(id: string) {
    const product = await this.getWithStockOrThrow(id);
    return this.toSellerView(product);
  }

  async stock(id: string) {
    await this.getWithStockOrThrow(id);
    const inventories = await this.prisma.inventory.findMany({
      where: { productId: id },
      include: { warehouse: { select: { id: true, name: true } } },
    });

    const byWarehouse = inventories.map((inv) => ({
      warehouseId: inv.warehouseId,
      warehouseName: inv.warehouse.name,
      quantity: inv.quantity,
      reservedQuantity: inv.reservedQuantity,
      availableQuantity: inv.quantity - inv.reservedQuantity,
    }));

    const totals = byWarehouse.reduce(
      (acc, w) => ({
        quantity: acc.quantity + w.quantity,
        reservedQuantity: acc.reservedQuantity + w.reservedQuantity,
        availableQuantity: acc.availableQuantity + w.availableQuantity,
      }),
      { quantity: 0, reservedQuantity: 0, availableQuantity: 0 },
    );

    return { byWarehouse, totals };
  }

  async create(dto: CreateProductDto, actorId: string) {
    const existing = await this.prisma.product.findUnique({
      where: { sku: dto.sku },
    });
    if (existing) throw new ConflictException('SKU already exists');
    const { stock, ...write } = dto;
    const created = await this.prisma.product.create({
      data: write as Prisma.ProductUncheckedCreateInput,
    });
    if (stock !== undefined) {
      await this.setCatalogStock(
        created.id,
        await this.catalogWarehouseId(),
        stock,
      );
    }
    await this.audit.record({
      userId: actorId,
      action: AuditAction.CREATE,
      entityType: 'Product',
      entityId: created.id,
      after: auditSnapshot(created),
    });
    return created;
  }

  async update(id: string, dto: UpdateProductDto, actorId: string) {
    const before = await this.getOrThrow(id);
    const { stock, ...write } = dto;
    const after = await this.prisma.product.update({
      where: { id },
      data: write as Prisma.ProductUncheckedUpdateInput,
    });
    if (stock !== undefined) {
      await this.setCatalogStock(id, await this.catalogWarehouseId(), stock);
    }
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return after;
  }

  async remove(id: string, actorId: string) {
    const before = await this.getOrThrow(id);
    const after = await this.prisma.product.update({
      where: { id },
      data: { isActive: false },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.DELETE,
      entityType: 'Product',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return { success: true };
  }

  async setImage(id: string, imageUrl: string, actorId: string) {
    const before = await this.getOrThrow(id);
    const after = await this.prisma.product.update({
      where: { id },
      data: { imageUrl },
    });
    await this.audit.record({
      userId: actorId,
      action: AuditAction.UPDATE,
      entityType: 'Product',
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });
    return after;
  }

  /**
   * The catalog lookup behind the order form's product field. Matches by SKU,
   * name (either fragment) or a whole OEM number — ported from root's
   * `product-lookup-repository.ts`/`product-search.ts`; retired products are
   * excluded because a seller could never save an order line with one anyway.
   * Stock can't be sorted at the database level here (it's Inventory-derived,
   * not a column), so matches are fetched, computed, then sorted in memory —
   * in-stock rows first, matching the order the seller expects to scan.
   */
  async search(term: string) {
    const trimmed = term.trim();
    const insensitive = { contains: trimmed, mode: 'insensitive' as const };

    const matches = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { nameUz: insensitive },
          { nameRu: insensitive },
          { sku: insensitive },
          { oemNumbers: { has: trimmed } },
          { oemNumbers: { has: trimmed.toUpperCase() } },
        ],
      },
      include: ADMIN_INCLUDE,
    });

    return matches
      .map((product) => this.withStock(product))
      .sort(
        (a, b) =>
          b.availableQuantity - a.availableQuantity ||
          (a.nameUz ?? '').localeCompare(b.nameUz ?? ''),
      )
      .slice(0, 8)
      .map((product) => ({
        id: product.id,
        sku: product.sku,
        name: product.nameUz,
        oemNumbers: product.oemNumbers,
        price: product.price === null ? null : Number(product.price),
        currency: product.currency,
        stock: product.availableQuantity,
        stockStatus: product.stockStatus,
      }));
  }

  /**
   * The whole catalog as CSV, retired products included — the director edits
   * the export and imports it back, so an omitted row would read as a delete.
   * The `stock` column carries the computed available quantity.
   */
  async exportCsv(): Promise<string> {
    const all = await this.prisma.product.findMany({
      include: ADMIN_INCLUDE,
      orderBy: { sku: 'asc' },
    });

    const rows: ProductCsvRow[] = all.map((product) => {
      const stock = this.withStock(product);
      return {
        id: product.id,
        sku: product.sku,
        slug: product.slug,
        oemNumbers: product.oemNumbers,
        nameUz: product.nameUz,
        nameRu: product.nameRu,
        nameEn: product.nameEn,
        descriptionUz: product.descriptionUz,
        descriptionRu: product.descriptionRu,
        descriptionEn: product.descriptionEn,
        price: product.price === null ? null : Number(product.price),
        stock: stock.availableQuantity,
        minStock: product.minStock,
        categoryId: product.categoryId,
        brandId: product.brandId,
        compatibleModels: product.compatibleModels,
        isActive: product.isActive,
      };
    });

    return toCsv(rows);
  }

  /**
   * Bulk create/update from a CSV upload. Validation is all-or-nothing — a typo
   * on line 80 blocks the whole file so the catalog is never left half-changed
   * — and every bad row is reported with its line number at once. Each row goes
   * through the same `create`/`update` path as a single write, so SKU-collision
   * checks and audit logging apply identically.
   */
  async importCsv(csv: string, actorId: string): Promise<ImportProductsResult> {
    const { rows, errors: structural } = readProductCsv(csv);
    if (structural.length > 0) {
      return { success: false, created: 0, updated: 0, errors: structural };
    }

    const invalid: CsvRowError[] = [];
    const valid: { line: number; dto: ImportProductRowDto }[] = [];

    for (const row of rows) {
      const { line, ...candidate } = row;
      const dto = plainToInstance(ImportProductRowDto, candidate);
      const failures = await validate(dto, {
        whitelist: true,
        stopAtFirstError: true,
      });
      if (failures.length > 0) {
        const first = failures[0];
        const message = Object.values(first.constraints ?? {})[0] ?? 'invalid';
        invalid.push({ line, message: `${first.property}: ${message}` });
        continue;
      }
      valid.push({ line, dto });
    }

    if (invalid.length > 0) {
      return { success: false, created: 0, updated: 0, errors: invalid };
    }

    const warehouseId = await this.catalogWarehouseId();
    const failures: CsvRowError[] = [];
    let created = 0;
    let updated = 0;

    for (const { line, dto } of valid) {
      const { id, stock, ...write } = dto;
      try {
        const product = id
          ? await this.update(id, write, actorId)
          : await this.create(write, actorId);
        await this.setCatalogStock(product.id, warehouseId, stock);
        if (id) updated += 1;
        else created += 1;
      } catch (error) {
        failures.push({ line, message: this.importFailureMessage(error, id) });
      }
    }

    return {
      success: failures.length === 0,
      created,
      updated,
      errors: failures,
    };
  }

  private importFailureMessage(error: unknown, id: string | undefined): string {
    if (error instanceof ConflictException) return 'Bu SKU allaqachon band.';
    if (error instanceof NotFoundException) {
      return `Mahsulot topilmadi (id: ${id ?? ''}).`;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      return 'Kategoriya yoki brend topilmadi.';
    }
    throw error;
  }

  private async catalogWarehouseId(): Promise<string> {
    const existing = await this.prisma.warehouse.findFirst({
      where: { name: CATALOG_WAREHOUSE_NAME },
    });
    if (existing) return existing.id;
    const created = await this.prisma.warehouse.create({
      data: { name: CATALOG_WAREHOUSE_NAME },
    });
    return created.id;
  }

  private async setCatalogStock(
    productId: string,
    warehouseId: string,
    quantity: number,
  ) {
    await this.prisma.inventory.upsert({
      where: { productId_warehouseId: { productId, warehouseId } },
      create: { productId, warehouseId, quantity, reservedQuantity: 0 },
      update: { quantity },
    });
  }

  private async getOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  private async getWithStockOrThrow(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: ADMIN_INCLUDE,
    });
    if (!product) throw new NotFoundException('Product not found');
    return this.withStock(product);
  }

  private toSellerView<T extends Record<string, unknown>>(product: T) {
    const clone = { ...product };
    for (const field of SELLER_HIDDEN_FIELDS) delete clone[field];
    return clone;
  }
}
