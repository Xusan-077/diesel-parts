import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AuditAction } from '../../generated/prisma/client';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { QueryProductDto } from './dto/query-product.dto';
import { paginationMeta } from '../common/dto/pagination.dto';
import { deriveStockStatus } from './stock-status';

const ADMIN_INCLUDE = {
  category: { select: { id: true, nameEn: true } },
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

    const all = await this.prisma.product.findMany({
      where,
      include: ADMIN_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    let withStock = all.map((product) => this.withStock(product));
    if (query.stockStatus) {
      withStock = withStock.filter(
        (product) => product.stockStatus === query.stockStatus,
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
    const created = await this.prisma.product.create({ data: dto });
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
    const after = await this.prisma.product.update({
      where: { id },
      data: dto,
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
