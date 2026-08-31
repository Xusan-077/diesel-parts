import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("./product-stats-repository", () => ({ getProductStats: vi.fn().mockResolvedValue(new Map()) }));

import { BackendApiError, backendRequest } from "./backend-client";
import {
  getPriceBounds,
  getProductBySlug,
  getProductsByIds,
  getProductsForHomeRows,
  listBrands,
  listCategories,
  listProductSlugs,
  queryProducts,
} from "./product-repository";
import type { ProductQuery } from "./product-query";

function productRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    slug: "slug-1",
    sku: "SKU-1",
    oemNumbers: [],
    nameUz: "Nomi",
    nameRu: "Название",
    nameEn: "Name",
    descriptionUz: "",
    descriptionRu: "",
    descriptionEn: "",
    price: "1000.00",
    categoryId: "c1",
    brandId: "b1",
    compatibleModels: [],
    specs: [],
    imageUrl: null,
    stockStatus: "IN_STOCK",
    ...overrides,
  };
}

function baseQuery(overrides: Partial<ProductQuery> = {}): ProductQuery {
  return {
    q: "",
    brandIds: [],
    categoryId: "all",
    categoryIds: undefined,
    availability: "all",
    priceMin: null,
    priceMax: null,
    sort: "newest",
    page: 1,
    pageSize: 9,
    lang: "uz",
    ...overrides,
  };
}

describe("product-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
  });

  describe("queryProducts", () => {
    it("maps a plain query onto backend/'s catalog/products params", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [productRow()],
        meta: { page: 1, limit: 9, total: 1, totalPages: 1 },
      });

      await queryProducts(baseQuery({ q: "pump", sort: "name-asc" }));

      expect(backendRequest).toHaveBeenCalledWith("/catalog/products", {
        query: {
          search: "pump",
          lang: "uz",
          brandIds: "",
          categoryIds: undefined,
          categoryId: undefined,
          stockStatus: undefined,
          priceMin: undefined,
          priceMax: undefined,
          sort: "name-asc",
          page: 1,
          limit: 9,
        },
      });
    });

    it("translates the availability filter to backend/'s stock status vocabulary", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
      });

      await queryProducts(baseQuery({ availability: "limited" }));

      expect(backendRequest).toHaveBeenCalledWith(
        "/catalog/products",
        expect.objectContaining({ query: expect.objectContaining({ stockStatus: "LOW_STOCK" }) }),
      );
    });

    it("answers locally, without a network call, when categoryIds is a deliberate empty scope", async () => {
      const result = await queryProducts(baseQuery({ categoryIds: [] }));

      expect(backendRequest).not.toHaveBeenCalled();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it("sends the single categoryId only when categoryIds is entirely absent", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [],
        meta: { page: 1, limit: 9, total: 0, totalPages: 1 },
      });

      await queryProducts(baseQuery({ categoryId: "c1" }));

      expect(backendRequest).toHaveBeenCalledWith(
        "/catalog/products",
        expect.objectContaining({ query: expect.objectContaining({ categoryId: "c1", categoryIds: undefined }) }),
      );
    });
  });

  describe("getProductBySlug", () => {
    it("returns the mapped product on success", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce(productRow());

      const product = await getProductBySlug("slug-1");

      expect(product?.id).toBe("p1");
    });

    it("returns null on a 404", async () => {
      vi.mocked(backendRequest).mockRejectedValueOnce(new BackendApiError("Not found", 404, "not_found"));

      expect(await getProductBySlug("missing")).toBeNull();
    });

    it("rethrows any other failure rather than reporting it as not-found", async () => {
      vi.mocked(backendRequest).mockRejectedValueOnce(new BackendApiError("Down", 503, "unavailable"));

      await expect(getProductBySlug("slug-1")).rejects.toThrow("Down");
    });
  });

  describe("getProductsByIds", () => {
    it("returns an empty array without a network call for an empty id list", async () => {
      expect(await getProductsByIds([], "uz")).toEqual([]);
      expect(backendRequest).not.toHaveBeenCalled();
    });

    it("preserves the caller's order and drops ids that no longer exist", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [
          {
            ...productRow({ id: "b" }),
            category: { id: "c1", nameUz: "Kat", nameRu: "Кат", nameEn: "Cat", parentId: null },
            brand: { name: "Bosch" },
          },
        ],
        meta: { page: 1, limit: 2, total: 1, totalPages: 1 },
      });

      const result = await getProductsByIds(["a", "b"], "uz");

      expect(result).toHaveLength(1);
      expect(result[0].product.id).toBe("b");
      expect(result[0].brandName).toBe("Bosch");
      expect(result[0].categoryName).toBe("Kat");
    });
  });

  describe("listBrands", () => {
    it("maps backend/'s brand list", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce([
        { id: "b1", slug: "bosch", name: "Bosch", logoUrl: null },
      ]);

      const brands = await listBrands();

      expect(brands).toEqual([{ id: "b1", slug: "bosch", name: "Bosch", logoUrl: null }]);
      expect(backendRequest).toHaveBeenCalledWith("/catalog/brands");
    });
  });

  describe("getPriceBounds", () => {
    it("rounds outward to a 10 000 step", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [{ price: "123456" }, { price: "998" }, { price: null }],
        meta: { page: 1, limit: 100, total: 3, totalPages: 1 },
      });

      expect(await getPriceBounds()).toEqual({ min: 0, max: 130000 });
    });

    it("returns null when nothing has a price", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce({
        data: [{ price: null }],
        meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
      });

      expect(await getPriceBounds()).toBeNull();
    });
  });

  describe("listCategories", () => {
    it("flattens backend/'s nested tree back to a flat list", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce([
        {
          id: "root",
          slug: "root",
          nameUz: "Ildiz",
          nameRu: "Root",
          nameEn: "Root",
          parentId: null,
          children: [
            {
              id: "child",
              slug: "child",
              nameUz: "Bola",
              nameRu: "Child",
              nameEn: "Child",
              parentId: "root",
              children: [],
            },
          ],
        },
      ]);

      const categories = await listCategories();

      expect(categories.map((c) => c.id)).toEqual(["root", "child"]);
      expect(categories.every((c) => !("children" in c))).toBe(true);
    });
  });

  describe("getProductsForHomeRows", () => {
    it("issues three bounded requests, one per row", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 4, total: 0, totalPages: 1 },
      });

      await getProductsForHomeRows(4);

      expect(backendRequest).toHaveBeenCalledTimes(3);
      expect(backendRequest).toHaveBeenCalledWith("/catalog/products", { query: { sort: "id", limit: 4 } });
      expect(backendRequest).toHaveBeenCalledWith("/catalog/products", { query: { limit: 4 } });
      expect(backendRequest).toHaveBeenCalledWith("/catalog/products", {
        query: { sort: "id", stockStatus: "IN_STOCK", limit: 4 },
      });
    });
  });

  describe("listProductSlugs", () => {
    it("passes backend/'s slug list through", async () => {
      vi.mocked(backendRequest).mockResolvedValueOnce(["a", "b"]);

      expect(await listProductSlugs()).toEqual(["a", "b"]);
    });
  });
});
