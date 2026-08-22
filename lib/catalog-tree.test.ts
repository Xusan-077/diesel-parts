import { describe, expect, it } from "vitest";
import {
  branchIndex,
  buildCatalogTree,
  buildCategoryTree,
  scopeFromTree,
  slugify,
  type CatalogRow,
} from "./catalog-tree";
import type { Category, LocalizedText } from "./types";

/** One name in all three locales, so a tree fixture stays one line per row. */
function text(value: string): LocalizedText {
  return { uz: value, ru: value, en: value };
}

function row(overrides: Partial<CatalogRow> & Pick<CatalogRow, "id">): CatalogRow {
  return {
    slug: overrides.id,
    name: { uz: overrides.id, ru: overrides.id, en: overrides.id },
    type: "general",
    order: 0,
    icon: null,
    parentId: null,
    ...overrides,
  };
}

describe("buildCatalogTree", () => {
  it("nests children under their parent and leaves roots at the top", () => {
    const tree = buildCatalogTree([
      row({ id: "engine" }),
      row({ id: "injector", parentId: "engine" }),
      row({ id: "piston", parentId: "engine" }),
      row({ id: "brakes" }),
    ]);

    expect(tree.map((node) => node.id)).toEqual(["brakes", "engine"]);
    expect(tree[1].children.map((node) => node.id)).toEqual(["injector", "piston"]);
    expect(tree[0].children).toEqual([]);
  });

  it("sorts siblings by order, then by the Uzbek name", () => {
    const tree = buildCatalogTree([
      row({ id: "c", order: 2, name: { uz: "C", ru: "C", en: "C" } }),
      row({ id: "b", order: 1, name: { uz: "B", ru: "Z", en: "Z" } }),
      row({ id: "a", order: 1, name: { uz: "A", ru: "A", en: "A" } }),
    ]);

    expect(tree.map((node) => node.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the sort stable when the reader's language changes", () => {
    // The Russian names sort the other way round; the menu must not.
    const rows = [
      row({ id: "a", name: { uz: "Avto", ru: "Яблоко", en: "Apple" } }),
      row({ id: "b", name: { uz: "Bolt", ru: "Автомат", en: "Bolt" } }),
    ];

    expect(buildCatalogTree(rows).map((node) => node.id)).toEqual(["a", "b"]);
  });

  it("treats a row whose parent is missing as a root rather than dropping it", () => {
    const tree = buildCatalogTree([row({ id: "orphan", parentId: "gone" })]);
    expect(tree.map((node) => node.id)).toEqual(["orphan"]);
  });

  it("does not let a row parent itself into an empty tree", () => {
    const tree = buildCatalogTree([row({ id: "loop", parentId: "loop" })]);
    expect(tree.map((node) => node.id)).toEqual(["loop"]);
  });
});

describe("scopeFromTree", () => {
  const tree = buildCatalogTree([
    row({ id: "engine", slug: "dvigatel-va-komponentlari" }),
    row({ id: "injector", slug: "forsunkalar", parentId: "engine" }),
    row({ id: "piston", slug: "porshen", parentId: "engine", order: 1 }),
    row({ id: "brakes", slug: "tormoz-tizimi", order: 1 }),
  ]);

  it("resolves a group to itself and everything under it", () => {
    expect(scopeFromTree(tree, { group: "dvigatel-va-komponentlari" })?.categoryIds).toEqual([
      "engine",
      "injector",
      "piston",
    ]);
  });

  it("resolves a subcategory to a single id", () => {
    expect(scopeFromTree(tree, { category: "porshen" })?.categoryIds).toEqual(["piston"]);
  });

  it("resolves a root reached through ?category= like a group", () => {
    expect(scopeFromTree(tree, { category: "tormoz-tizimi" })?.categoryIds).toEqual(["brakes"]);
  });

  it("prefers group over category when both are given", () => {
    const scope = scopeFromTree(tree, { group: "tormoz-tizimi", category: "porshen" });
    expect(scope?.categoryIds).toEqual(["brakes"]);
  });

  it("returns null for missing or unknown slugs", () => {
    expect(scopeFromTree(tree, {})).toBeNull();
    expect(scopeFromTree(tree, { group: "nope" })).toBeNull();
    expect(scopeFromTree(tree, { category: "nope" })).toBeNull();
  });
});

describe("slugify", () => {
  it("keeps the spelling the existing menu already uses for o' and g'", () => {
    expect(slugify("Yoqilg'i filtri")).toBe("yoqilgi-filtri");
    expect(slugify("O'rindiqlar")).toBe("orindiqlar");
  });

  it("accepts a curly apostrophe as the same letter", () => {
    expect(slugify("Yoqilg’i filtri")).toBe("yoqilgi-filtri");
  });

  it("transliterates a Russian name instead of emptying it", () => {
    expect(slugify("Тормозные колодки")).toBe("tormoznie-kolodki");
  });

  it("strips accents, punctuation and repeated separators", () => {
    expect(slugify("  Motoröl / Filter --- 2  ")).toBe("motorol-filter-2");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});

describe("buildCategoryTree", () => {
  const flat: Category[] = [
    { id: "engine", slug: "engine", name: text("Dvigatel"), parentId: null },
    { id: "injector", slug: "injector", name: text("Forsunka"), parentId: "engine" },
    { id: "piston", slug: "piston", name: text("Porshen"), parentId: "engine" },
    { id: "brakes", slug: "brakes", name: text("Tormoz"), parentId: null },
  ];

  it("nests children under the branch they belong to", () => {
    const tree = buildCategoryTree(flat);
    expect(tree.map((node) => node.id)).toEqual(["engine", "brakes"]);
    expect(tree[0].children.map((node) => node.id)).toEqual(["injector", "piston"]);
    expect(tree[1].children).toEqual([]);
  });

  it("keeps the order it was given, which is already menu order", () => {
    const tree = buildCategoryTree([flat[3], flat[0], flat[2], flat[1]]);
    expect(tree.map((node) => node.id)).toEqual(["brakes", "engine"]);
    expect(tree[0].children).toEqual([]);
    expect(tree[1].children.map((node) => node.id)).toEqual(["piston", "injector"]);
  });

  it("treats a category with no parent field at all as a root", () => {
    // The seed data omits `parentId` entirely; that has to read as a flat list
    // rather than as a tree with nothing in it.
    const tree = buildCategoryTree([{ id: "valve", slug: "valve", name: text("Klapan") }]);
    expect(tree.map((node) => node.id)).toEqual(["valve"]);
  });

  it("raises an orphan to a root rather than dropping it", () => {
    // A category missing from the filter is harder to notice than one sitting a
    // level too high.
    const tree = buildCategoryTree([
      { id: "seal", slug: "seal", name: text("Zichlagich"), parentId: "deleted" },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["seal"]);
  });

  it("does not lose a row that points at itself", () => {
    const tree = buildCategoryTree([
      { id: "loop", slug: "loop", name: text("Loop"), parentId: "loop" },
    ]);
    expect(tree.map((node) => node.id)).toEqual(["loop"]);
    expect(tree[0].children).toEqual([]);
  });
});

describe("branchIndex", () => {
  it("points every category at the branch that holds it", () => {
    const index = branchIndex(
      buildCategoryTree([
        { id: "engine", slug: "engine", name: text("Dvigatel"), parentId: null },
        { id: "injector", slug: "injector", name: text("Forsunka"), parentId: "engine" },
      ]),
    );
    expect(index.get("injector")).toBe("engine");
  });

  it("points a branch at itself, so selecting one opens it", () => {
    const index = branchIndex(
      buildCategoryTree([{ id: "engine", slug: "engine", name: text("Dvigatel") }]),
    );
    expect(index.get("engine")).toBe("engine");
  });

  it("knows nothing about a category that is not in the tree", () => {
    expect(branchIndex([]).get("engine")).toBeUndefined();
  });
});
