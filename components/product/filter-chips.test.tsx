// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterChips } from "./filter-chips";
import type { FilterChip } from "@/lib/catalog-filters";
import dictionary from "@/dictionaries/uz.json";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode; href: string }) => (
    <a {...props}>{children}</a>
  ),
}));

const dict = dictionary.catalog;

const BRAND: FilterChip = { key: "brandId", label: dict.filterBrandLabel, value: "CAT" };
const STOCK: FilterChip = {
  key: "availability",
  label: dict.filterAvailabilityLabel,
  value: dictionary.common.stock.available,
};

function renderChips(
  chips: FilterChip[],
  extra: Partial<React.ComponentProps<typeof FilterChips>> = {}
) {
  const onRemove = vi.fn();
  const onClearAll = vi.fn();

  render(
    <FilterChips
      chips={chips}
      dict={dict}
      onRemove={onRemove}
      onClearAll={onClearAll}
      {...extra}
    />
  );

  return { onRemove, onClearAll };
}

afterEach(cleanup);

describe("FilterChips", () => {
  it("stays out of the way when nothing is narrowing the grid", () => {
    const { container } = render(
      <FilterChips chips={[]} dict={dict} onRemove={vi.fn()} onClearAll={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("names both halves of a filter, not just the value", () => {
    renderChips([BRAND]);

    // "CAT" alone is a brand, a category and a search term to the reader.
    const row = screen.getByRole("group", { name: dict.filtersActiveTitle });
    expect(row.textContent).toContain(dict.filterBrandLabel);
    expect(row.textContent).toContain("CAT");
  });

  it("takes a filter off when its own ✕ is pressed", async () => {
    const { onRemove } = renderChips([BRAND, STOCK]);

    await userEvent.click(
      screen.getByRole("button", {
        name: dict.filterRemove
          .replace("{label}", dict.filterBrandLabel)
          .replace("{value}", "CAT"),
      })
    );

    expect(onRemove).toHaveBeenCalledWith("brandId");
  });

  it("offers clear-all only once there is more than one thing to clear", async () => {
    cleanup();
    renderChips([BRAND]);
    // With one chip it duplicates that chip's ✕, one control further away.
    expect(screen.queryByRole("button", { name: dict.filtersClearAll })).toBeNull();

    cleanup();
    const { onClearAll } = renderChips([BRAND, STOCK]);
    await userEvent.click(screen.getByRole("button", { name: dict.filtersClearAll }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("shows the catalog menu's scope as a chip that links back", () => {
    renderChips([], {
      scope: { label: "Dvigatel qismlari", clearLabel: dict.clearScope },
    });

    expect(screen.getByText("Dvigatel qismlari")).toBeDefined();
    // A scope arrives in the URL, so leaving it is a navigation, not a setState.
    expect(screen.getByRole("link", { name: dict.clearScope })).toHaveProperty(
      "href",
      expect.stringContaining("/products")
    );
  });

  it("shows the scope alongside the filters rather than instead of them", () => {
    renderChips([BRAND], {
      scope: { label: "Dvigatel qismlari", clearLabel: dict.clearScope },
    });

    const row = screen.getByRole("group", { name: dict.filtersActiveTitle });
    expect(row.textContent).toContain("Dvigatel qismlari");
    expect(row.textContent).toContain("CAT");
  });
});
