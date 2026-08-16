import {
  catalogGroups,
  type CatalogGroup,
  type CatalogSubcategory,
} from "@/lib/data/catalog-menu";
import type { LocalizedText } from "@/lib/types";

export function findGroupBySlug(slug: string): CatalogGroup | undefined {
  return catalogGroups.find((group) => group.slug === slug);
}

export function findSubcategoryBySlug(slug: string): CatalogSubcategory | undefined {
  for (const group of catalogGroups) {
    const match = group.subcategories.find((subcategory) => subcategory.slug === slug);
    if (match) {
      return match;
    }
  }
  return undefined;
}

/** Product category ids the mock catalog actually has for this group. */
export function categoryIdsForGroup(group: CatalogGroup): string[] {
  return group.subcategories
    .map((subcategory) => subcategory.categoryId)
    .filter((id): id is string => id !== undefined);
}

export interface CatalogScope {
  label: LocalizedText;
  /**
   * Product category ids this scope covers. An empty array is meaningful: the
   * menu entry exists but the mock catalog carries no products for it yet.
   */
  categoryIds: string[];
}

/**
 * Resolves the `?group=` / `?category=` slugs the catalog menu links to.
 * `group` wins when both are present. Unknown slugs resolve to `null` so the
 * product list falls back to showing everything.
 */
export function resolveCatalogScope(params: {
  group?: string;
  category?: string;
}): CatalogScope | null {
  if (params.group) {
    const group = findGroupBySlug(params.group);
    return group ? { label: group.name, categoryIds: categoryIdsForGroup(group) } : null;
  }

  if (params.category) {
    const subcategory = findSubcategoryBySlug(params.category);
    if (!subcategory) {
      return null;
    }
    return {
      label: subcategory.name,
      categoryIds: subcategory.categoryId ? [subcategory.categoryId] : [],
    };
  }

  return null;
}
