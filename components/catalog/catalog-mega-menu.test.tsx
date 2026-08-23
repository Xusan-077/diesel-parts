// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CatalogMegaMenu } from "./catalog-mega-menu";
import type { CatalogNode } from "@/lib/catalog-tree";
import dictionary from "@/dictionaries/uz.json";

const get = vi.fn();

vi.mock("axios", () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    isAxiosError: () => false,
  },
}));

const { header, nav } = dictionary;

function node(id: string, children: string[] = []): CatalogNode {
  return {
    id,
    slug: id,
    name: { uz: id, ru: id, en: id },
    type: "engine",
    order: 0,
    icon: null,
    parentId: null,
    children: children.map((child) => ({
      ...node(child),
      parentId: id,
    })),
  };
}

const TREE = [node("dvigatel", ["forsunkalar", "porshen"]), node("tormoz", ["kolodkalar"])];

function renderMenu() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <QueryClientProvider client={client}>
      <CatalogMegaMenu
        lang="uz"
        header={header}
        allProductsLabel={nav.allProducts}
      />
    </QueryClientProvider>,
  );
}

/** The left rail is the menu's own landmark, so it scopes down to just the section list. */
function leftRail() {
  return within(screen.getByRole("navigation", { name: header.catalog }));
}

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { items: TREE } });
});

afterEach(cleanup);

describe("CatalogMegaMenu before it is opened", () => {
  it("asks for nothing — the menu is opened on a minority of visits", () => {
    renderMenu();

    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole("navigation", { name: header.catalog })).toBeNull();
  });

  it("does not open on hover", async () => {
    renderMenu();

    await userEvent.hover(screen.getByRole("button", { name: header.catalog }));

    expect(get).not.toHaveBeenCalled();
  });
});

describe("CatalogMegaMenu once it is open", () => {
  it("fetches the tree on the first click and previews the first section by default", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    await waitFor(() => expect(leftRail().getByRole("link", { name: "dvigatel" })).toBeDefined());
    expect(get).toHaveBeenCalledWith("/api/catalog");

    // Every section is listed in the left rail.
    expect(leftRail().getByRole("link", { name: "tormoz" })).toBeDefined();

    // The first section is previewed on the right without any hover.
    expect(screen.getByRole("link", { name: "forsunkalar" }).getAttribute("href")).toBe(
      "/products?category=forsunkalar",
    );
    expect(screen.getByRole("link", { name: "porshen" })).toBeDefined();

    // The second section's own subcategory is not shown until it is active.
    expect(screen.queryByRole("link", { name: "kolodkalar" })).toBeNull();
  });

  it("switches the right panel when a different section is hovered", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(leftRail().getByRole("link", { name: "tormoz" })).toBeDefined());

    await userEvent.hover(leftRail().getByRole("link", { name: "tormoz" }));

    await waitFor(() => expect(screen.getByRole("link", { name: "kolodkalar" })).toBeDefined());
    expect(screen.getByRole("link", { name: "kolodkalar" }).getAttribute("href")).toBe(
      "/products?category=kolodkalar",
    );
    expect(screen.queryByRole("link", { name: "forsunkalar" })).toBeNull();
  });

  it("switches the right panel when a section link is focused", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(leftRail().getByRole("link", { name: "tormoz" })).toBeDefined());

    leftRail().getByRole("link", { name: "tormoz" }).focus();

    await waitFor(() => expect(screen.getByRole("link", { name: "kolodkalar" })).toBeDefined());
  });

  it("names the loading state for a reader who cannot see the skeleton", async () => {
    let release: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((resolve) => (release = resolve)));

    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    expect(screen.getByText(header.catalogLoading)).toBeDefined();

    release({ data: { items: TREE } });
    await waitFor(() => expect(leftRail().getByRole("link", { name: "dvigatel" })).toBeDefined());
  });

  it("closes on Escape", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(leftRail().getByRole("link", { name: "dvigatel" })).toBeDefined());

    await userEvent.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("navigation", { name: header.catalog })).toBeNull(),
    );
  });

  it("offers a retry rather than an empty menu when the read fails", async () => {
    get.mockRejectedValueOnce(new Error("down"));
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(header.catalogError)).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: header.catalogRetry }));

    await waitFor(() => expect(leftRail().getByRole("link", { name: "dvigatel" })).toBeDefined());
  });

  it("says so when the catalog has no sections at all", async () => {
    get.mockResolvedValue({ data: { items: [] } });
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    await waitFor(() => expect(screen.getByText(header.catalogEmpty)).toBeDefined());
  });

  it("hides subcategories beyond the column cap behind a show-more link", async () => {
    const many = node(
      "dvigatel",
      Array.from({ length: 17 }, (_, index) => `sub-${index}`),
    );
    get.mockResolvedValue({ data: { items: [many] } });
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    await waitFor(() => expect(screen.getByRole("link", { name: "sub-0" })).toBeDefined());
    expect(screen.queryByRole("link", { name: "sub-16" })).toBeNull();

    const showMore = screen.getByRole("button", {
      name: header.catalogShowMore.replace("{count}", "2"),
    });
    await userEvent.click(showMore);

    await waitFor(() => expect(screen.getByRole("link", { name: "sub-16" })).toBeDefined());
  });
});
