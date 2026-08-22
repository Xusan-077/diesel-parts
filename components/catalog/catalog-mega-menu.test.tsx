// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

beforeEach(() => {
  get.mockReset();
  get.mockResolvedValue({ data: { items: TREE } });
});

afterEach(cleanup);

describe("CatalogMegaMenu before it is opened", () => {
  it("asks for nothing — the menu is opened on a minority of visits", () => {
    renderMenu();

    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: "dvigatel" })).toBeNull();
  });

  it("does not open on hover", async () => {
    renderMenu();

    await userEvent.hover(screen.getByRole("button", { name: header.catalog }));

    expect(get).not.toHaveBeenCalled();
  });
});

describe("CatalogMegaMenu once it is open", () => {
  it("fetches the tree on the first click and draws a column per section", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    await waitFor(() => expect(screen.getByRole("link", { name: "dvigatel" })).toBeDefined());
    expect(get).toHaveBeenCalledWith("/api/catalog");

    // A column heading scopes the catalog to the whole section; an entry
    // beneath it scopes to one category.
    expect(screen.getByRole("link", { name: "dvigatel" }).getAttribute("href")).toBe(
      "/products?group=dvigatel",
    );
    expect(screen.getByRole("link", { name: "forsunkalar" }).getAttribute("href")).toBe(
      "/products?category=forsunkalar",
    );
  });

  it("names the loading state for a reader who cannot see the skeleton", async () => {
    let release: (value: unknown) => void = () => {};
    get.mockReturnValue(new Promise((resolve) => (release = resolve)));

    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    expect(screen.getByText(header.catalogLoading)).toBeDefined();

    release({ data: { items: TREE } });
    await waitFor(() => expect(screen.getByRole("link", { name: "dvigatel" })).toBeDefined());
  });

  it("closes on Escape", async () => {
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(screen.getByRole("link", { name: "dvigatel" })).toBeDefined());

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("link", { name: "dvigatel" })).toBeNull());
  });

  it("offers a retry rather than an empty menu when the read fails", async () => {
    get.mockRejectedValueOnce(new Error("down"));
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeDefined());
    expect(screen.getByText(header.catalogError)).toBeDefined();

    await userEvent.click(screen.getByRole("button", { name: header.catalogRetry }));

    await waitFor(() => expect(screen.getByRole("link", { name: "dvigatel" })).toBeDefined());
  });

  it("says so when the catalog has no sections at all", async () => {
    get.mockResolvedValue({ data: { items: [] } });
    renderMenu();

    await userEvent.click(screen.getByRole("button", { name: header.catalog }));

    await waitFor(() => expect(screen.getByText(header.catalogEmpty)).toBeDefined());
  });
});
