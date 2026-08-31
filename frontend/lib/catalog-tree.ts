import type { CatalogIconKey } from "@/lib/data/catalog-menu";
import type { Category, LocalizedText } from "@/lib/types";

/**
 * The catalog menu, as rows and as the tree the header draws from them.
 *
 * Pure on purpose: the shape the menu needs is decided here, and
 * `lib/api/catalog-repository.ts` only supplies rows. That keeps the ordering
 * rules, the depth rule and the `?group=`/`?category=` resolution unit-testable
 * without a database, and keeps one answer for the header, the mobile drawer
 * and the products page.
 */

/** One Category row, flattened to what the menu actually reads. */
export interface CatalogRow {
  id: string;
  slug: string;
  name: LocalizedText;
  /** Part family — "engine", "brakes", "filters". Shared by a root and its children. */
  type: string;
  order: number;
  /** Pictogram key, or null when nobody has chosen one. */
  icon: CatalogIconKey | null;
  parentId: string | null;
}

export interface CatalogNode extends CatalogRow {
  children: CatalogNode[];
}

/**
 * Siblings by `order`, ties broken on the Uzbek name.
 *
 * The tie-break is what makes an unset order usable: every new category starts
 * at 0, and without a second key the menu would reshuffle those rows on every
 * query. Uzbek rather than the reader's language so the menu's shape does not
 * change when the language does — a column that moves when you switch to
 * Russian reads as a bug, not as a translation.
 */
function bySiblingOrder(a: CatalogRow, b: CatalogRow): number {
  return a.order - b.order || a.name.uz.localeCompare(b.name.uz, "uz");
}

/**
 * Roots with their children attached, both sorted.
 *
 * Two levels deep, which is the menu's whole contract: a root is a column and
 * its children are that column's entries. The write API refuses a parent that
 * is not itself a root, so a third level cannot be created through the panel —
 * and a row that somehow points at a missing parent is treated as a root rather
 * than dropped, because a category missing from the menu is harder to notice
 * than one in the wrong place.
 */
export function buildCatalogTree(rows: readonly CatalogRow[]): CatalogNode[] {
  const byId = new Map(rows.map((row) => [row.id, { ...row, children: [] as CatalogNode[] }]));
  const roots: CatalogNode[] = [];

  for (const node of byId.values()) {
    const parent = node.parentId === null ? undefined : byId.get(node.parentId);

    if (parent === undefined || parent.id === node.id) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  for (const root of roots) {
    root.children.sort(bySiblingOrder);
  }

  return roots.sort(bySiblingOrder);
}

export interface CatalogScope {
  label: LocalizedText;
  /** Category ids the scope covers — a root covers itself and its children. */
  categoryIds: string[];
}

/**
 * Resolves the `?group=` / `?category=` slugs the menu links to.
 *
 * `group` wins when both are present. Unknown slugs resolve to `null`, which
 * the products page reads as "no scope" and shows everything — a mistyped link
 * should show the catalog, not an empty grid.
 */
export function scopeFromTree(
  tree: readonly CatalogNode[],
  params: { group?: string; category?: string },
): CatalogScope | null {
  if (params.group) {
    const root = tree.find((node) => node.slug === params.group);
    return root ? scopeForNode(root) : null;
  }

  if (params.category) {
    for (const root of tree) {
      if (root.slug === params.category) {
        return scopeForNode(root);
      }

      const child = root.children.find((node) => node.slug === params.category);
      if (child) {
        return scopeForNode(child);
      }
    }
  }

  return null;
}

function scopeForNode(node: CatalogNode): CatalogScope {
  return {
    label: node.name,
    // The root itself is included: nothing stops a product hanging directly off
    // a column, and leaving it out would hide those parts from their own menu.
    categoryIds: [node.id, ...node.children.map((child) => child.id)],
  };
}

/**
 * A URL-safe slug from a category name.
 *
 * Uzbek Latin first: `o'` and `g'` are single letters, and stripping the
 * apostrophe outright would turn "Yoqilg'i" into "yoqilgi" — which is the form
 * the existing menu already uses, so this reproduces it rather than inventing a
 * second spelling. Cyrillic is transliterated so a Russian name still yields a
 * usable slug instead of an empty one.
 */
const TRANSLITERATION: ReadonlyArray<[RegExp, string]> = [
  [/[’‘`´]/g, "'"],
  [/o'/g, "o"],
  [/g'/g, "g"],
  [/щ/g, "sh"],
  [/ш/g, "sh"],
  [/ч/g, "ch"],
  [/ж/g, "j"],
  [/ю/g, "yu"],
  [/я/g, "ya"],
  [/ё/g, "yo"],
  [/э/g, "e"],
  [/ы/g, "i"],
  [/х/g, "h"],
  [/ц/g, "ts"],
  [/[ъь]/g, ""],
  [/а/g, "a"],
  [/б/g, "b"],
  [/в/g, "v"],
  [/г/g, "g"],
  [/д/g, "d"],
  [/е/g, "e"],
  [/з/g, "z"],
  [/и/g, "i"],
  [/й/g, "y"],
  [/к/g, "k"],
  [/л/g, "l"],
  [/м/g, "m"],
  [/н/g, "n"],
  [/о/g, "o"],
  [/п/g, "p"],
  [/р/g, "r"],
  [/с/g, "s"],
  [/т/g, "t"],
  [/у/g, "u"],
  [/ф/g, "f"],
];

export function slugify(value: string): string {
  let text = value.toLowerCase().trim();

  for (const [pattern, replacement] of TRANSLITERATION) {
    text = text.replace(pattern, replacement);
  }

  return text
    // Strip accents left by a Latin name — "Motorölfilter" → "motorolfilter".
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The shape `/api/catalog` answers with. */
export interface CatalogTreeResponse {
  items: CatalogNode[];
}

/* ── Filter sidebar ───────────────────────────────────────────────────────── */

/** A category and the categories under it, as the filter sidebar nests them. */
export interface CategoryTreeNode {
  id: string;
  slug: string;
  name: LocalizedText;
  children: CategoryTreeNode[];
}

/**
 * Nests a flat category list for the catalog's filter sidebar.
 *
 * Deliberately separate from `buildCatalogTree` above: that one shapes the
 * header's menu from rows carrying an icon, a family and a sibling order, and
 * this one shapes a filter from the public `Category`, which carries none of
 * those. Input order is preserved rather than re-sorted — the repository
 * already reads them in menu order, and sorting again here would be a second
 * opinion about the same question.
 *
 * A row whose parent is missing is treated as a root, for the same reason the
 * menu does it: a category absent from the filter is harder to notice than one
 * sitting a level too high.
 */
export function buildCategoryTree(categories: readonly Category[]): CategoryTreeNode[] {
  const byId = new Map(
    categories.map((category) => [
      category.id,
      { id: category.id, slug: category.slug, name: category.name, children: [] as CategoryTreeNode[] },
    ]),
  );

  const roots: CategoryTreeNode[] = [];

  for (const category of categories) {
    const node = byId.get(category.id);
    if (node === undefined) {
      continue;
    }

    const parentId = category.parentId ?? null;
    const parent = parentId === null || parentId === category.id ? undefined : byId.get(parentId);

    if (parent === undefined) {
      roots.push(node);
    } else {
      parent.children.push(node);
    }
  }

  return roots;
}

/**
 * Which branch each category sits in, keyed by category id.
 *
 * The sidebar needs it to open the right branch when a filter arrives already
 * set — from a chip, a restored URL, or the menu's own scope — so the selected
 * row is visible instead of hidden inside a shut group. A root maps to itself.
 */
export function branchIndex(tree: readonly CategoryTreeNode[]): Map<string, string> {
  const index = new Map<string, string>();

  for (const root of tree) {
    index.set(root.id, root.id);
    for (const child of root.children) {
      index.set(child.id, root.id);
    }
  }

  return index;
}
