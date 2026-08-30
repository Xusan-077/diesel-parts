import { describe, expect, it, vi } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { searchSellableProducts } from "./product-lookup-repository";

const SESSION = {
  role: "SELLER" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

describe("searchSellableProducts", () => {
  it("queries backend/'s widened search endpoint with the staff session's token", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue([
      { id: "p1", sku: "DP-1", name: "Nasos", oemNumbers: [], price: "1000", currency: "UZS", stock: 3, stockStatus: "available" },
    ]);

    const result = await searchSellableProducts("nasos");

    expect(backendRequest).toHaveBeenCalledWith("/products/search", {
      accessToken: "tok",
      query: { q: "nasos" },
    });
    expect(result).toEqual([
      { id: "p1", sku: "DP-1", name: "Nasos", oemNumbers: [], price: 1000, currency: "UZS", stock: 3, stockStatus: "available" },
    ]);
  });

  it("keeps a null price null for a part priced on request", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue([
      { id: "p1", sku: "DP-1", name: "Nasos", oemNumbers: [], price: null, currency: "UZS", stock: 0, stockStatus: "out_of_stock" },
    ]);

    const result = await searchSellableProducts("nasos");

    expect(result[0].price).toBeNull();
  });
});
