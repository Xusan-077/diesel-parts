import type { Prisma } from "@/prisma/generated/prisma/client";

/**
 * The lookup behind the order form's product field.
 *
 * Pure, in the same spirit as `product-where.ts`: the storefront's catalog
 * query and this one answer different questions and must not share a `where`
 * by accident, but both are worth asserting without a database.
 */

/** Enough rows to choose from; more than this and the seller should type more. */
export const PRODUCT_SEARCH_LIMIT = 8;

/** Below this a search matches half the catalog and helps nobody. */
export const PRODUCT_SEARCH_MIN_LENGTH = 2;

/**
 * Matches a part by the three things a seller has to hand on a call.
 *
 * The name is matched case-insensitively anywhere in the string; the SKU the
 * same way, because sellers quote the tail of an article number as often as
 * the whole of it. OEM numbers are the exception: they live in a `String[]`,
 * where Prisma can only test whole elements, so the term is tried as written
 * and upper-cased rather than as a fragment. That is the right trade anyway —
 * a partial OEM number matches the wrong part more often than the right one.
 *
 * Retired products are excluded, because `buildLines` refuses them on save and
 * offering one here would only produce a failure two steps later.
 */
export function sellableProductWhere(term: string): Prisma.ProductWhereInput {
  const trimmed = term.trim();
  const insensitive = { contains: trimmed, mode: "insensitive" } as const;

  return {
    isActive: true,
    OR: [
      { nameUz: insensitive },
      { nameRu: insensitive },
      { sku: insensitive },
      { oemNumbers: { has: trimmed } },
      { oemNumbers: { has: trimmed.toUpperCase() } },
    ],
  };
}

/**
 * The in-stock rows first, then the rest.
 *
 * A seller scanning results wants what they can promise today at the top; the
 * out-of-stock rows still appear, because a part that has to be brought in is
 * a real order, just a slower one.
 */
export const PRODUCT_SEARCH_ORDER: Prisma.ProductOrderByWithRelationInput[] = [
  { stock: "desc" },
  { nameUz: "asc" },
];
