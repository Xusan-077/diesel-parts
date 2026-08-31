import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import {
  createCategory,
  deleteCategory,
  getCatalogTree,
  listCatalogRows,
  updateCategory,
  type CategoryWriteRefusal,
} from "./catalog-repository";
import type { CategoryWriteInput } from "@/lib/schemas";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

const INPUT: CategoryWriteInput = {
  name: { uz: "Dvigatel", ru: "Dvigatel", en: "Engine" },
  slug: "engine",
  type: "engine",
  parentId: null,
  order: 0,
  icon: "engine",
};

describe("catalog-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("getCatalogTree", () => {
    it("flattens backend/'s nested tree and drops an unknown icon key", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "root-a",
          slug: "engine",
          nameUz: "Dvigatel",
          nameRu: "Dvigatel",
          nameEn: "Engine",
          type: "engine",
          order: 0,
          icon: "engine",
          parentId: null,
          children: [
            {
              id: "child-a1",
              slug: "pistons",
              nameUz: "Porshenlar",
              nameRu: "Porshni",
              nameEn: "Pistons",
              type: "engine",
              order: 0,
              icon: "not-a-real-icon",
              parentId: "root-a",
              children: [],
            },
          ],
        },
      ]);

      const tree = await getCatalogTree();

      expect(backendRequest).toHaveBeenCalledWith("/catalog/categories");
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe("root-a");
      expect(tree[0].icon).toBe("engine");
      expect(tree[0].children).toHaveLength(1);
      expect(tree[0].children[0].id).toBe("child-a1");
      expect(tree[0].children[0].icon).toBeNull();
    });
  });

  describe("listCatalogRows", () => {
    it("maps backend/'s _count onto productCount/childCount", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "root-a",
          slug: "engine",
          nameUz: "Dvigatel",
          nameRu: "Dvigatel",
          nameEn: "Engine",
          type: "engine",
          order: 0,
          icon: "engine",
          parentId: null,
          _count: { children: 2, products: 5 },
        },
      ]);

      const rows = await listCatalogRows();

      expect(backendRequest).toHaveBeenCalledWith("/categories", { accessToken: "tok" });
      expect(rows).toEqual([
        expect.objectContaining({
          id: "root-a",
          slug: "engine",
          productCount: 5,
          childCount: 2,
        }),
      ]);
    });
  });

  describe("createCategory", () => {
    it("POSTs and returns the created id on success", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "cuid-1" });

      const result = await createCategory(INPUT, "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/categories", {
        method: "POST",
        accessToken: "tok",
        body: {
          slug: "engine",
          nameUz: "Dvigatel",
          nameRu: "Dvigatel",
          nameEn: "Engine",
          type: "engine",
          order: 0,
          icon: "engine",
          parentId: null,
        },
      });
      expect(result).toEqual({ ok: true, id: "cuid-1" });
    });

    it.each<[number, string, CategoryWriteRefusal]>([
      [409, "duplicate_slug", "duplicate_slug"],
      [400, "parent_not_found", "parent_not_found"],
      [400, "parent_not_root", "parent_not_root"],
      [409, "has_children", "has_children"],
      [409, "has_products", "has_products"],
    ])("maps a %i/%s error onto %s", async (status, code, reason) => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("nope", status, code));

      const result = await createCategory(INPUT, "actor-1");

      expect(result).toEqual({ ok: false, reason });
    });

    it("rethrows an error whose code matches no known refusal", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(createCategory(INPUT, "actor-1")).rejects.toThrow("Down");
    });
  });

  describe("updateCategory", () => {
    it("PATCHes and returns the id on success", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "cat-1" });

      const result = await updateCategory("cat-1", INPUT, "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/categories/cat-1", {
        method: "PATCH",
        accessToken: "tok",
        body: {
          slug: "engine",
          nameUz: "Dvigatel",
          nameRu: "Dvigatel",
          nameEn: "Engine",
          type: "engine",
          order: 0,
          icon: "engine",
          parentId: null,
        },
      });
      expect(result).toEqual({ ok: true, id: "cat-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "Not Found"));

      const result = await updateCategory("missing", INPUT, "actor-1");

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it.each<[number, string, CategoryWriteRefusal]>([
      [409, "duplicate_slug", "duplicate_slug"],
      [400, "parent_not_found", "parent_not_found"],
      [400, "parent_not_root", "parent_not_root"],
      [409, "has_children", "has_children"],
      [409, "has_products", "has_products"],
    ])("maps a %i/%s error onto %s", async (status, code, reason) => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("nope", status, code));

      const result = await updateCategory("cat-1", INPUT, "actor-1");

      expect(result).toEqual({ ok: false, reason });
    });

    it("rethrows an error whose code matches no known refusal", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(updateCategory("cat-1", INPUT, "actor-1")).rejects.toThrow("Down");
    });
  });

  describe("deleteCategory", () => {
    it("DELETEs and reports ok", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ success: true });

      const result = await deleteCategory("cat-1", "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/categories/cat-1", {
        method: "DELETE",
        accessToken: "tok",
      });
      expect(result).toEqual({ ok: true, id: "cat-1" });
    });

    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Not found", 404, "Not Found"));

      const result = await deleteCategory("missing", "actor-1");

      expect(result).toEqual({ ok: false, reason: "not_found" });
    });

    it.each<[number, string, CategoryWriteRefusal]>([
      [409, "has_children", "has_children"],
      [409, "has_products", "has_products"],
    ])("maps a %i/%s error onto %s", async (status, code, reason) => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("nope", status, code));

      const result = await deleteCategory("cat-1", "actor-1");

      expect(result).toEqual({ ok: false, reason });
    });

    it("rethrows an error whose code matches no known refusal", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

      await expect(deleteCategory("cat-1", "actor-1")).rejects.toThrow("Down");
    });
  });
});
