import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isCatalogIconKey } from "@/lib/data/catalog-menu";
import {
  buildCatalogTree,
  scopeFromTree,
  type CatalogNode,
  type CatalogRow,
  type CatalogScope,
} from "@/lib/catalog-tree";
import type { CategoryWriteInput } from "@/lib/schemas";
import { recordAudit } from "./audit";

/** The columns the menu and the panel read. `createdAt` is not one of them. */
const ROW_SELECT = {
  id: true,
  slug: true,
  nameUz: true,
  nameRu: true,
  nameEn: true,
  type: true,
  order: true,
  icon: true,
  parentId: true,
} as const;

interface CategoryRecord {
  id: string;
  slug: string;
  nameUz: string;
  nameRu: string;
  nameEn: string;
  type: string;
  order: number;
  icon: string | null;
  parentId: string | null;
}

function toRow(record: CategoryRecord): CatalogRow {
  return {
    id: record.id,
    slug: record.slug,
    name: { uz: record.nameUz, ru: record.nameRu, en: record.nameEn },
    type: record.type,
    order: record.order,
    // An icon key with no component behind it — left over from an older key
    // list, say — is dropped rather than rendered as a gap.
    icon: isCatalogIconKey(record.icon) ? record.icon : null,
    parentId: record.parentId,
  };
}

async function readRows(): Promise<CatalogRow[]> {
  const records = await prisma.category.findMany({
    select: ROW_SELECT,
    orderBy: [{ order: "asc" }, { nameUz: "asc" }],
  });

  return records.map(toRow);
}

/**
 * The whole menu, roots first.
 *
 * One query for every level: the tree is ~50 rows, so reading them flat and
 * shaping them in memory beats a nested include that fans out a query per root.
 */
export const getCatalogTree = cache(async (): Promise<CatalogNode[]> => {
  return buildCatalogTree(await readRows());
});

/**
 * Resolves `/products?group=…` / `?category=…` against the menu.
 *
 * `cache` matters here: `generateMetadata` and the page body both ask, and
 * without it every catalog page would read the table twice per request.
 */
export const getCatalogScope = cache(
  async (params: { group?: string; category?: string }): Promise<CatalogScope | null> => {
    if (!params.group && !params.category) {
      return null;
    }

    return scopeFromTree(await getCatalogTree(), params);
  },
);

/* ── Director panel ───────────────────────────────────────────────────────── */

export interface CatalogAdminRow extends CatalogRow {
  /** Products hanging directly off this category — not off its children. */
  productCount: number;
  childCount: number;
}

/**
 * Every category with the two counts that decide whether it can be deleted.
 *
 * Both come from grouped counts rather than from `_count` on each row, so the
 * listing stays three queries however long the tree gets.
 */
export async function listCatalogRows(): Promise<CatalogAdminRow[]> {
  const [rows, productCounts, childCounts] = await Promise.all([
    readRows(),
    prisma.product.groupBy({ by: ["categoryId"], _count: { _all: true } }),
    prisma.category.groupBy({ by: ["parentId"], _count: { _all: true } }),
  ]);

  const products = new Map(productCounts.map((row) => [row.categoryId, row._count._all]));
  const children = new Map(
    childCounts
      .filter((row): row is typeof row & { parentId: string } => row.parentId !== null)
      .map((row) => [row.parentId, row._count._all]),
  );

  return rows.map((row) => ({
    ...row,
    productCount: products.get(row.id) ?? 0,
    childCount: children.get(row.id) ?? 0,
  }));
}

export type CategoryWriteRefusal =
  | "duplicate_slug"
  | "not_found"
  | "parent_not_found"
  | "parent_not_root"
  | "has_children"
  | "has_products";

export type CategoryWriteResult =
  | { ok: true; id: string }
  | { ok: false; reason: CategoryWriteRefusal };

/**
 * Checks the parent a write asks for.
 *
 * The menu is two levels — a root is a column, its children are that column's
 * entries — so a parent that is itself a child is refused rather than silently
 * rendered nowhere. Pointing a category at itself is caught here too: it would
 * otherwise detach that row and everything under it from the tree.
 */
async function checkParent(
  parentId: string,
  self: string | null,
): Promise<CategoryWriteRefusal | null> {
  if (parentId === self) {
    return "parent_not_root";
  }

  const parent = await prisma.category.findUnique({
    where: { id: parentId },
    select: { parentId: true },
  });

  if (parent === null) {
    return "parent_not_found";
  }

  return parent.parentId === null ? null : "parent_not_root";
}

function auditFields(input: CategoryWriteInput) {
  return {
    slug: input.slug,
    name: input.name.uz,
    type: input.type,
    parentId: input.parentId,
    order: input.order,
  };
}

export async function createCategory(
  input: CategoryWriteInput,
  actorId: string,
): Promise<CategoryWriteResult> {
  const taken = await prisma.category.findUnique({ where: { slug: input.slug } });
  if (taken !== null) {
    return { ok: false, reason: "duplicate_slug" };
  }

  if (input.parentId !== null) {
    const refusal = await checkParent(input.parentId, null);
    if (refusal !== null) {
      return { ok: false, reason: refusal };
    }
  }

  const created = await prisma.category.create({
    data: {
      // The slug is the id, as it is for every category the seed writes: this
      // catalog's ids are readable strings rather than cuids, and a product
      // import keyed by category id is far easier to check by eye that way.
      id: input.slug,
      slug: input.slug,
      nameUz: input.name.uz,
      nameRu: input.name.ru,
      nameEn: input.name.en,
      type: input.type,
      order: input.order,
      icon: input.icon,
      parentId: input.parentId,
    },
    select: { id: true },
  });

  await recordAudit({
    userId: actorId,
    action: "CREATE",
    entityType: "Category",
    entityId: created.id,
    after: auditFields(input),
  });

  return { ok: true, id: created.id };
}

export async function updateCategory(
  id: string,
  input: CategoryWriteInput,
  actorId: string,
): Promise<CategoryWriteResult> {
  const before = await prisma.category.findUnique({ where: { id }, select: ROW_SELECT });
  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  if (input.slug !== before.slug) {
    const taken = await prisma.category.findUnique({ where: { slug: input.slug } });
    if (taken !== null) {
      return { ok: false, reason: "duplicate_slug" };
    }
  }

  if (input.parentId !== null) {
    const refusal = await checkParent(input.parentId, id);
    if (refusal !== null) {
      return { ok: false, reason: refusal };
    }

    // A root with children cannot become a child itself: that would push its
    // own children onto a third level the menu does not draw.
    if (before.parentId === null) {
      const children = await prisma.category.count({ where: { parentId: id } });
      if (children > 0) {
        return { ok: false, reason: "has_children" };
      }
    }
  }

  await prisma.category.update({
    where: { id },
    data: {
      slug: input.slug,
      nameUz: input.name.uz,
      nameRu: input.name.ru,
      nameEn: input.name.en,
      type: input.type,
      order: input.order,
      icon: input.icon,
      parentId: input.parentId,
    },
  });

  await recordAudit({
    userId: actorId,
    action: "UPDATE",
    entityType: "Category",
    entityId: id,
    before: {
      slug: before.slug,
      name: before.nameUz,
      type: before.type,
      parentId: before.parentId,
      order: before.order,
    },
    after: auditFields(input),
  });

  return { ok: true, id };
}

/**
 * Deletes a category, or explains why it cannot be.
 *
 * Both refusals exist because the alternative is worse than a message:
 * cascading would take a whole column of the menu down with one click, and the
 * product reference would be refused by Postgres anyway — as a foreign-key
 * error the panel could only report as "something went wrong".
 */
export async function deleteCategory(id: string, actorId: string): Promise<CategoryWriteResult> {
  const before = await prisma.category.findUnique({ where: { id }, select: ROW_SELECT });
  if (before === null) {
    return { ok: false, reason: "not_found" };
  }

  const [children, products] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.product.count({ where: { categoryId: id } }),
  ]);

  if (children > 0) {
    return { ok: false, reason: "has_children" };
  }

  if (products > 0) {
    return { ok: false, reason: "has_products" };
  }

  await prisma.category.delete({ where: { id } });

  await recordAudit({
    userId: actorId,
    action: "DELETE",
    entityType: "Category",
    entityId: id,
    before: { slug: before.slug, name: before.nameUz, parentId: before.parentId },
  });

  return { ok: true, id };
}
