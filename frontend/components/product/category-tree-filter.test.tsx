// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CategoryTreeFilter } from "./category-tree-filter";
import type { Category, LocalizedText } from "@/lib/types";
import dictionary from "@/dictionaries/uz.json";

const dict = dictionary.catalog;

function text(value: string): LocalizedText {
  return { uz: value, ru: value, en: value };
}

const CATEGORIES: Category[] = [
  { id: "engine", slug: "engine", name: text("Dvigatel"), parentId: null },
  { id: "injector", slug: "injector", name: text("Forsunka"), parentId: "engine" },
  { id: "piston", slug: "piston", name: text("Porshen"), parentId: "engine" },
  { id: "brakes", slug: "brakes", name: text("Tormoz"), parentId: null },
];

function renderTree(value = "all", categories = CATEGORIES) {
  const onChange = vi.fn();
  render(
    <CategoryTreeFilter
      categories={categories}
      lang="uz"
      value={value}
      onChange={onChange}
      dict={dict}
    />
  );
  return { onChange };
}

const expandEngine = () =>
  screen.getByRole("button", {
    name: dict.categoryExpand.replace("{label}", "Dvigatel"),
  });

afterEach(cleanup);

describe("CategoryTreeFilter", () => {
  it("starts with the branches shut, so the whole tree is readable at a glance", () => {
    renderTree();
    expect(screen.getByRole("button", { name: "Dvigatel" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Forsunka" })).toBeNull();
    expect(expandEngine().getAttribute("aria-expanded")).toBe("false");
  });

  it("opens a branch without selecting it", async () => {
    const { onChange } = renderTree();
    await userEvent.click(expandEngine());

    expect(screen.getByRole("button", { name: "Forsunka" })).toBeTruthy();
    // "Show me what is in here" and "filter by this" are different intentions.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("selects a branch without closing it", async () => {
    const { onChange } = renderTree();
    await userEvent.click(expandEngine());
    await userEvent.click(screen.getByRole("button", { name: "Dvigatel" }));

    expect(onChange).toHaveBeenCalledWith("engine");
    expect(screen.getByRole("button", { name: "Forsunka" })).toBeTruthy();
  });

  it("filters by a category inside a branch", async () => {
    const { onChange } = renderTree();
    await userEvent.click(expandEngine());
    await userEvent.click(screen.getByRole("button", { name: "Forsunka" }));

    expect(onChange).toHaveBeenCalledWith("injector");
  });

  it("opens the branch holding a selection that arrived already set", () => {
    // From a chip, a restored URL or the menu's own scope — the reader has to
    // be shown where they are, not left in front of a shut tree.
    renderTree("injector");
    expect(screen.getByRole("button", { name: "Forsunka" })).toBeTruthy();
    expect(expandEngine().getAttribute("aria-expanded")).toBe("true");
  });

  it("marks the selected row, and only that row", () => {
    renderTree("injector");
    expect(screen.getByRole("button", { name: "Forsunka" }).getAttribute("aria-pressed")).toBe(
      "true"
    );
    expect(screen.getByRole("button", { name: "Dvigatel" }).getAttribute("aria-pressed")).toBe(
      "false"
    );
  });

  it("offers a way back to the whole catalog", async () => {
    const { onChange } = renderTree("injector");
    const all = screen.getByRole("button", { name: dict.allCategories });
    expect(all.getAttribute("aria-pressed")).toBe("false");

    await userEvent.click(all);
    expect(onChange).toHaveBeenCalledWith("all");
  });

  it("gives a branch with nothing under it no chevron to press", () => {
    renderTree();
    expect(
      screen.queryByRole("button", {
        name: dict.categoryExpand.replace("{label}", "Tormoz"),
      })
    ).toBeNull();
  });

  it("holds a long tree back behind one toggle", async () => {
    const many: Category[] = Array.from({ length: 9 }, (_, index) => ({
      id: `c${index}`,
      slug: `c${index}`,
      name: text(`Turkum ${index}`),
      parentId: null,
    }));
    renderTree("all", many);

    expect(screen.queryByRole("button", { name: "Turkum 8" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: `${dict.showMore} (3)` }));
    expect(screen.getByRole("button", { name: "Turkum 8" })).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: dict.showLess }));
    expect(screen.queryByRole("button", { name: "Turkum 8" })).toBeNull();
  });
});
