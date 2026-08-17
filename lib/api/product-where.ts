import type { Prisma } from "@/prisma/generated/prisma/client";
import type { Locale } from "@/lib/i18n/locales";
import type { ProductQuery } from "./product-query";

type SortDirection = "asc" | "desc";

/** The name column for a locale, as a literal object Prisma's types accept. */
function nameOrderBy(
  lang: Locale,
  direction: SortDirection
): Prisma.ProductOrderByWithRelationInput {
  switch (lang) {
    case "uz":
      return { nameUz: direction };
    case "ru":
      return { nameRu: direction };
    case "en":
      return { nameEn: direction };
  }
}

/** A case-insensitive contains filter on the name column for a locale. */
function nameContains(lang: Locale, value: string): Prisma.ProductWhereInput {
  const filter = { contains: value, mode: "insensitive" } as const;

  switch (lang) {
    case "uz":
      return { nameUz: filter };
    case "ru":
      return { nameRu: filter };
    case "en":
      return { nameEn: filter };
  }
}

/**
 * Turns a parsed catalog query into Prisma arguments.
 *
 * Pure on purpose: it replaced `filterProducts`/`sortProducts`, and keeping the
 * translation in a function that returns a plain object means every case those
 * carried is still asserted without needing a database.
 */
export function buildProductWhere(query: ProductQuery): {
  where: Prisma.ProductWhereInput;
  orderBy: Prisma.ProductOrderByWithRelationInput;
} {
  const where: Prisma.ProductWhereInput = { isActive: true };

  if (query.brandId !== "all") {
    where.brandId = query.brandId;
  }

  // The catalog menu passes an explicit set, which wins over the single value.
  // An empty set is a real scope that matches nothing, not an absent filter.
  if (query.categoryIds !== undefined) {
    where.categoryId = { in: query.categoryIds };
  } else if (query.categoryId !== "all") {
    where.categoryId = query.categoryId;
  }

  if (query.availability !== "all") {
    where.stockStatus = query.availability;
  }

  if (query.q.length > 0) {
    where.OR = [
      nameContains(query.lang, query.q),
      { sku: { contains: query.q, mode: "insensitive" } },
      { oemNumbers: { has: query.q } },
    ];
  }

  return { where, orderBy: buildOrderBy(query.sort, query.lang) };
}

function buildOrderBy(
  sort: ProductQuery["sort"],
  lang: Locale
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "name-asc":
      return nameOrderBy(lang, "asc");
    case "name-desc":
      return nameOrderBy(lang, "desc");
    case "newest":
      return { createdAt: "desc" };
  }
}
