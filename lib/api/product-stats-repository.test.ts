import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});

import { backendRequest } from "./backend-client";
import { getProductStats, getProductStatsFor } from "./product-stats-repository";

describe("getProductStats", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
  });

  it("returns an empty map without a network call for an empty id list", async () => {
    const stats = await getProductStats([]);

    expect(stats.size).toBe(0);
    expect(backendRequest).not.toHaveBeenCalled();
  });

  it("keys the result by productId", async () => {
    vi.mocked(backendRequest).mockResolvedValue([
      { productId: "p1", rating: 4.3, reviewCount: 3, soldCount: 12 },
      { productId: "p2", rating: null, reviewCount: 0, soldCount: 0 },
    ]);

    const stats = await getProductStats(["p1", "p2"]);

    expect(backendRequest).toHaveBeenCalledWith("/catalog/products/stats", {
      query: { ids: "p1,p2" },
    });
    expect(stats.get("p1")).toEqual({ rating: 4.3, reviewCount: 3, soldCount: 12 });
    expect(stats.get("p2")).toEqual({ rating: null, reviewCount: 0, soldCount: 0 });
  });
});

describe("getProductStatsFor", () => {
  it("falls back to EMPTY_STATS when backend/ has nothing for this id", async () => {
    vi.mocked(backendRequest).mockResolvedValue([]);

    expect(await getProductStatsFor("p1")).toEqual({ rating: null, reviewCount: 0, soldCount: 0 });
  });
});
