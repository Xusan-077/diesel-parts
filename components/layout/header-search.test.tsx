// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HeaderSearch } from "./header-search";
import { MIN_QUERY_LENGTH, SUGGESTION_LIMIT } from "@/lib/search-suggest";
import type { Product } from "@/lib/types";
import dictionary from "@/dictionaries/uz.json";

const push = vi.fn();
const fetchProducts = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/api/products", () => ({
  fetchProducts: (...args: unknown[]) => fetchProducts(...args),
}));

const { header, common } = dictionary;

function product(patch: Partial<Product> = {}): Product {
  const id = patch.id ?? "p-1";
  return {
    id,
    slug: patch.slug ?? id,
    name: { uz: `CAT ${id}`, ru: `CAT ${id}`, en: `CAT ${id}` },
    sku: id.toUpperCase(),
    oemNumbers: [],
    price: 1_320_000,
    categoryId: "filter",
    brandId: "cat",
    description: { uz: "", ru: "", en: "" },
    compatibleModels: [],
    stockStatus: "available",
    specs: [],
    imageLabels: ["Front"],
    ...patch,
  };
}

function respondWith(items: Product[], total = items.length) {
  fetchProducts.mockResolvedValue({
    items,
    total,
    page: 1,
    pageSize: SUGGESTION_LIMIT,
    totalPages: 1,
    stats: {},
  });
}

function renderSearch() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  render(
    <QueryClientProvider client={client}>
      <HeaderSearch lang="uz" header={header} requestPriceLabel={common.requestPrice} />
    </QueryClientProvider>
  );

  return screen.getByRole("combobox");
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("header search", () => {
  it("asks for nothing until there is something to match on", async () => {
    respondWith([]);
    const field = renderSearch();

    await userEvent.type(field, "x".repeat(MIN_QUERY_LENGTH - 1));

    // Debounced, so give the timer more than its own delay to misbehave in.
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchProducts).not.toHaveBeenCalled();
  });

  it("asks for one short page of matches, not the catalog", async () => {
    respondWith([product()]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");

    await waitFor(() => expect(fetchProducts).toHaveBeenCalled());
    expect(fetchProducts).toHaveBeenLastCalledWith(
      expect.objectContaining({ q: "CAT", pageSize: SUGGESTION_LIMIT, lang: "uz" })
    );
  });

  it("debounces a burst of keystrokes into a single request", async () => {
    respondWith([product()]);
    const field = renderSearch();

    await userEvent.type(field, "CAT 950");

    await waitFor(() => expect(fetchProducts).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(fetchProducts).toHaveBeenCalledTimes(1);
    expect(fetchProducts).toHaveBeenLastCalledWith(expect.objectContaining({ q: "CAT 950" }));
  });

  it("offers each match as a row carrying its name and price", async () => {
    respondWith([product({ id: "p-1" }), product({ id: "p-2", price: null })]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");

    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0].textContent).toContain("1 320 000 so'm");
    // An unpriced part says so rather than showing a zero.
    expect(options[1].textContent).toContain(common.requestPrice);
    expect(screen.getAllByRole("link")[0]).toHaveProperty(
      "href",
      expect.stringContaining("/products/p-1")
    );
  });

  it("says so when the catalog has nothing", async () => {
    respondWith([]);
    const field = renderSearch();

    await userEvent.type(field, "zzzz");

    expect(await screen.findByText(header.searchEmpty)).toBeTruthy();
  });

  it("sends Enter to the full results page, where the filters are", async () => {
    respondWith([product()]);
    const field = renderSearch();

    await userEvent.type(field, "CAT 950");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{Enter}");

    expect(push).toHaveBeenCalledWith("/products?q=CAT%20950");
  });

  it("sends Enter to a suggestion once one is highlighted", async () => {
    respondWith([product({ id: "p-1", slug: "cat-950-filter" })]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(push).toHaveBeenCalledWith("/products/cat-950-filter");
  });

  it("marks the highlighted row for assistive technology", async () => {
    respondWith([product({ id: "p-1" }), product({ id: "p-2" })]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{ArrowDown}");

    const [first, second] = screen.getAllByRole("option");
    expect(first.getAttribute("aria-selected")).toBe("true");
    expect(second.getAttribute("aria-selected")).toBe("false");
    expect(field.getAttribute("aria-activedescendant")).toBe(first.id);
  });

  it("offers the whole result set, not just the six it shows", async () => {
    respondWith([product()], 124);
    const field = renderSearch();

    await userEvent.type(field, "CAT");

    const viewAll = await screen.findByRole("link", {
      name: new RegExp(header.searchViewAll),
    });
    expect(viewAll).toHaveProperty("href", expect.stringContaining("/products?q=CAT"));
    expect(viewAll.textContent).toContain("124");
  });

  it("closes on Escape without navigating anywhere", async () => {
    respondWith([product()]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
    expect(push).not.toHaveBeenCalled();
  });

  it("drops the panel when the field is cleared, rather than showing stale rows", async () => {
    respondWith([product()]);
    const field = renderSearch();

    await userEvent.type(field, "CAT");
    await screen.findAllByRole("option");

    await userEvent.clear(field);

    await waitFor(() => expect(screen.queryByRole("option")).toBeNull());
  });
});
