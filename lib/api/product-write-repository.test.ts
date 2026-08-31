import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  createProduct,
  findProductImageUrl,
  getProductForEdit,
  listProductsForAdmin,
  setProductActive,
  setProductImage,
  updateProduct,
} from "./product-write-repository";
import type { ProductWriteInput } from "@/lib/schemas";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

function writeInput(overrides: Partial<ProductWriteInput> = {}): ProductWriteInput {
  return {
    sku: "dp-1",
    slug: "dp-1",
    oemNumbers: ["oem-1"],
    name: { uz: "Nomi", ru: "Название", en: "Name" },
    description: { uz: "", ru: "", en: "" },
    price: 1000,
    stock: 5,
    minStock: 1,
    categoryId: "c1",
    brandId: "b1",
    compatibleModels: [],
    specs: [],
    isActive: true,
    ...overrides,
  };
}

describe("product-write-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("createProduct", () => {
    it("normalizes sku/oemNumbers and posts to backend/", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "p1" });

      const result = await createProduct(writeInput({ sku: " dp-1 ", oemNumbers: [" oem-1 "] }), "actor-1");

      expect(result).toEqual({ ok: true, value: { id: "p1" } });
      expect(backendRequest).toHaveBeenCalledWith("/products", {
        method: "POST",
        accessToken: "tok",
        body: expect.objectContaining({ sku: "DP-1", oemNumbers: ["OEM-1"] }),
      });
    });

    it("maps a 409 to a duplicate result naming the colliding field", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("slug already exists", 409, "Conflict"));

      const result = await createProduct(writeInput(), "actor-1");

      expect(result).toEqual({ ok: false, reason: "duplicate", field: "slug" });
    });

    it("maps a 400 to missing_reference", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Category or brand not found", 400, "Bad Request"));

      const result = await createProduct(writeInput(), "actor-1");

      expect(result).toEqual({ ok: false, reason: "missing_reference", field: "categoryId" });
    });

    it("rethrows any other failure", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(createProduct(writeInput(), "actor-1")).rejects.toThrow("Down");
    });
  });

  describe("updateProduct", () => {
    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Product not found", 404, "Not Found"));

      const result = await updateProduct("p1", writeInput(), "actor-1");

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it("returns ok on success", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "p1" });

      expect(await updateProduct("p1", writeInput(), "actor-1")).toEqual({ ok: true, value: { id: "p1" } });
    });
  });

  describe("setProductActive", () => {
    it("PATCHes isActive and returns ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "p1" });

      const result = await setProductActive("p1", false, "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/products/p1", {
        method: "PATCH",
        accessToken: "tok",
        body: { isActive: false },
      });
      expect(result).toEqual({ ok: true, value: { id: "p1" } });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Product not found", 404, "Not Found"));

      expect(await setProductActive("missing", false, "actor-1")).toEqual({ ok: false, reason: "not_found" });
    });
  });

  describe("listProductsForAdmin", () => {
    it("maps availableQuantity to stock and nested names to flat fields", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        data: [
          {
            id: "p1",
            sku: "DP-1",
            slug: "dp-1",
            nameUz: "Nasos",
            price: "1000",
            availableQuantity: 7,
            minStock: 2,
            category: { nameUz: "Kategoriya" },
            brand: { name: "Bosch" },
            isActive: true,
            imageUrl: null,
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await listProductsForAdmin({ search: "", page: 1, includeInactive: false, sort: "stock" });

      expect(result.items).toEqual([
        {
          id: "p1",
          sku: "DP-1",
          slug: "dp-1",
          name: "Nasos",
          price: 1000,
          stock: 7,
          minStock: 2,
          categoryName: "Kategoriya",
          brandName: "Bosch",
          isActive: true,
          imageUrl: null,
        },
      ]);
      expect(backendRequest).toHaveBeenCalledWith("/products", {
        accessToken: "tok",
        query: { search: undefined, isActive: "true", sort: "stock", lang: undefined, page: 1, limit: 20 },
      });
    });

    it("requests every product when includeInactive is true", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });

      await listProductsForAdmin({ search: "", page: 1, includeInactive: true, sort: "stock" });

      expect(backendRequest).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({ query: expect.objectContaining({ isActive: undefined }) }),
      );
    });

    it("maps the name sort onto backend/'s locale-aware name-asc", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 1 } });

      await listProductsForAdmin({ search: "", page: 1, includeInactive: false, sort: "name" });

      expect(backendRequest).toHaveBeenCalledWith(
        "/products",
        expect.objectContaining({ query: expect.objectContaining({ sort: "name-asc", lang: "uz" }) }),
      );
    });
  });

  describe("getProductForEdit", () => {
    it("maps the backend/ row into ProductEditRecord", async () => {
      vi.mocked(backendRequest).mockResolvedValue({
        sku: "DP-1",
        slug: "dp-1",
        oemNumbers: ["OEM-1"],
        nameUz: "Uz",
        nameRu: "Ru",
        nameEn: "En",
        descriptionUz: "",
        descriptionRu: "",
        descriptionEn: "",
        price: "1000",
        availableQuantity: 5,
        minStock: 1,
        categoryId: "c1",
        brandId: "b1",
        compatibleModels: [],
        specs: [],
        isActive: true,
        imageUrl: "/a.jpg",
      });

      const record = await getProductForEdit("p1");

      expect(record?.price).toBe(1000);
      expect(record?.stock).toBe(5);
      expect(record?.name).toEqual({ uz: "Uz", ru: "Ru", en: "En" });
    });

    it("returns null on a 404", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Product not found", 404, "Not Found"));

      expect(await getProductForEdit("missing")).toBeNull();
    });
  });

  describe("findProductImageUrl", () => {
    it("returns just the imageUrl", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ imageUrl: "/a.jpg" });

      expect(await findProductImageUrl("p1")).toEqual({ imageUrl: "/a.jpg" });
    });

    it("returns null on a 404", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Product not found", 404, "Not Found"));

      expect(await findProductImageUrl("missing")).toBeNull();
    });
  });

  describe("setProductImage", () => {
    it("PATCHes the image endpoint", async () => {
      vi.mocked(backendRequest).mockResolvedValue({});

      const result = await setProductImage("p1", "/a.jpg", "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/products/p1/image", {
        method: "PATCH",
        accessToken: "tok",
        body: { imageUrl: "/a.jpg" },
      });
      expect(result).toEqual({ ok: true, value: { imageUrl: "/a.jpg" } });
    });
  });
});
