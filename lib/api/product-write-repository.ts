import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { deriveStockStatus } from "./stock-status";
import { recordAudit } from "./audit";
import type { ProductWriteInput } from "@/lib/schemas";
import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * Writes to the catalog. Reads live in `product-repository.ts`; they are split
 * because every page reads and only the director's panel writes, and the write
 * path drags in the audit trail.
 */

export type WriteResult<T> =
  | { ok: true; value: T }
  | { ok: false; reason: "duplicate"; field: string }
  | { ok: false; reason: "missing_reference"; field: string }
  | { ok: false; reason: "not_found" };

/** Prisma's unique-violation code, and the field list it reports with it. */
function duplicateField(error: unknown): string | null {
  const candidate = error as { code?: string; meta?: { target?: unknown } };
  if (candidate?.code !== "P2002") {
    return null;
  }
  const target = candidate.meta?.target;
  if (Array.isArray(target) && typeof target[0] === "string") {
    return target[0];
  }
  return "sku";
}

/** Prisma's foreign-key violation — a category or brand id that does not exist. */
function isMissingReference(error: unknown): boolean {
  return (error as { code?: string })?.code === "P2003";
}

function toRow(input: ProductWriteInput) {
  return {
    sku: input.sku.trim().toUpperCase(),
    slug: input.slug.trim(),
    // Upper-cased on the way in, because search matches them with Prisma's
    // array `has`, which takes no case-insensitivity mode.
    oemNumbers: input.oemNumbers.map((oem) => oem.trim().toUpperCase()),
    nameUz: input.name.uz,
    nameRu: input.name.ru,
    nameEn: input.name.en,
    descriptionUz: input.description.uz,
    descriptionRu: input.description.ru,
    descriptionEn: input.description.en,
    price: input.price,
    stock: input.stock,
    minStock: input.minStock,
    // Never taken from the caller: the column has to agree with the numbers.
    stockStatus: deriveStockStatus(input.stock, input.minStock),
    categoryId: input.categoryId,
    brandId: input.brandId,
    compatibleModels: input.compatibleModels,
    specs: input.specs as unknown as Prisma.InputJsonValue,
    imageLabels: input.imageLabels,
    isActive: input.isActive,
  };
}

/** The shape written to the audit trail — enough to see what changed. */
function auditSnapshot(row: {
  sku: string;
  slug: string;
  nameUz: string;
  price: unknown;
  stock: number;
  minStock: number;
  isActive: boolean;
}) {
  return {
    sku: row.sku,
    slug: row.slug,
    name: row.nameUz,
    price: row.price === null ? null : Number(row.price),
    stock: row.stock,
    minStock: row.minStock,
    isActive: row.isActive,
  };
}

export async function createProduct(
  input: ProductWriteInput,
  actorId: string,
): Promise<WriteResult<{ id: string }>> {
  try {
    const created = await prisma.product.create({
      data: { id: randomUUID(), ...toRow(input) },
    });

    await recordAudit({
      userId: actorId,
      action: "CREATE",
      entityType: "Product",
      entityId: created.id,
      after: auditSnapshot(created),
    });

    return { ok: true, value: { id: created.id } };
  } catch (error) {
    const field = duplicateField(error);
    if (field) {
      return { ok: false, reason: "duplicate", field };
    }
    if (isMissingReference(error)) {
      return { ok: false, reason: "missing_reference", field: "categoryId" };
    }
    throw error;
  }
}

export async function updateProduct(
  id: string,
  input: ProductWriteInput,
  actorId: string,
): Promise<WriteResult<{ id: string }>> {
  const before = await prisma.product.findUnique({ where: { id } });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  try {
    const after = await prisma.product.update({ where: { id }, data: toRow(input) });

    await recordAudit({
      userId: actorId,
      action: "UPDATE",
      entityType: "Product",
      entityId: id,
      before: auditSnapshot(before),
      after: auditSnapshot(after),
    });

    return { ok: true, value: { id } };
  } catch (error) {
    const field = duplicateField(error);
    if (field) {
      return { ok: false, reason: "duplicate", field };
    }
    if (isMissingReference(error)) {
      return { ok: false, reason: "missing_reference", field: "categoryId" };
    }
    throw error;
  }
}

/**
 * Retirement, not deletion.
 *
 * OrderItem references Product with `Restrict`, so a sold part can never be
 * deleted — and should not be: the order it appears on has to keep meaning
 * something. Clearing `isActive` takes it out of the catalog and every query.
 */
export async function setProductActive(
  id: string,
  isActive: boolean,
  actorId: string,
): Promise<WriteResult<{ id: string }>> {
  const before = await prisma.product.findUnique({ where: { id } });

  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const after = await prisma.product.update({ where: { id }, data: { isActive } });

  await recordAudit({
    userId: actorId,
    action: isActive ? "UPDATE" : "DELETE",
    entityType: "Product",
    entityId: id,
    before: auditSnapshot(before),
    after: auditSnapshot(after),
  });

  return { ok: true, value: { id } };
}

export interface AdminProductRow {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number | null;
  stock: number;
  minStock: number;
  categoryName: string;
  brandName: string;
  isActive: boolean;
}

export interface AdminProductPage {
  items: AdminProductRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const ADMIN_PAGE_SIZE = 20;

/**
 * The panel's own listing. It differs from the public one in three ways that
 * matter: inactive products are included, stock numbers are exposed, and the
 * sort defaults to what a director looks for — the shortest stock first.
 */
export async function listProductsForAdmin(options: {
  search: string;
  page: number;
  includeInactive: boolean;
  sort: "stock" | "name" | "price";
}): Promise<AdminProductPage> {
  const term = options.search.trim();
  const where: Prisma.ProductWhereInput = {
    ...(options.includeInactive ? {} : { isActive: true }),
    ...(term
      ? {
          OR: [
            { sku: { contains: term, mode: "insensitive" } },
            { nameUz: { contains: term, mode: "insensitive" } },
            { oemNumbers: { has: term.toUpperCase() } },
          ],
        }
      : {}),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    options.sort === "name"
      ? { nameUz: "asc" }
      : options.sort === "price"
        ? { price: "desc" }
        : { stock: "asc" };

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  const page = Math.min(Math.max(1, options.page), totalPages);

  const rows = await prisma.product.findMany({
    where,
    orderBy,
    skip: (page - 1) * ADMIN_PAGE_SIZE,
    take: ADMIN_PAGE_SIZE,
    include: { category: true, brand: true },
  });

  return {
    items: rows.map((row) => ({
      id: row.id,
      sku: row.sku,
      slug: row.slug,
      name: row.nameUz,
      price: row.price === null ? null : Number(row.price),
      stock: row.stock,
      minStock: row.minStock,
      categoryName: row.category.nameUz,
      brandName: row.brand.name,
      isActive: row.isActive,
    })),
    total,
    page,
    pageSize: ADMIN_PAGE_SIZE,
    totalPages,
  };
}

/** One product in the shape the edit form expects. */
export async function getProductForEdit(id: string): Promise<ProductWriteInput | null> {
  const row = await prisma.product.findUnique({ where: { id } });

  if (row === null) {
    return null;
  }

  return {
    sku: row.sku,
    slug: row.slug,
    oemNumbers: row.oemNumbers,
    name: { uz: row.nameUz, ru: row.nameRu, en: row.nameEn },
    description: { uz: row.descriptionUz, ru: row.descriptionRu, en: row.descriptionEn },
    price: row.price === null ? null : Number(row.price),
    stock: row.stock,
    minStock: row.minStock,
    categoryId: row.categoryId,
    brandId: row.brandId,
    compatibleModels: row.compatibleModels,
    specs: row.specs as unknown as ProductWriteInput["specs"],
    imageLabels: row.imageLabels,
    isActive: row.isActive,
  };
}
