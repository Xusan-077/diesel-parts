import { describe, expect, it, vi } from "vitest";
import { backendRequest } from "./backend-client";

describe("backendRequest", () => {
  it("sends a bearer token and returns parsed JSON on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1" }),
    });

    const result = await backendRequest("/products", { accessToken: "tok" });

    expect(result).toEqual({ id: "1" });
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("/products"),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer tok" }) }),
    );
  });

  it("throws BackendApiError with parsed message/code on a 4xx", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ message: "Product not found", error: "not_found" }),
    });

    await expect(backendRequest("/products/x")).rejects.toMatchObject({
      status: 404,
      code: "not_found",
      message: "Product not found",
    });
  });

  it("joins a class-validator message array into one string", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ message: ["name must be a string", "price must be positive"] }),
    });

    await expect(backendRequest("/products")).rejects.toMatchObject({
      status: 400,
      message: "name must be a string, price must be positive",
    });
  });

  it("returns undefined on a 204 without reading the body", async () => {
    const json = vi.fn();
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 204, json });

    const result = await backendRequest("/products/x", { method: "DELETE", accessToken: "tok" });

    expect(result).toBeUndefined();
    expect(json).not.toHaveBeenCalled();
  });

  it("forwards a refresh cookie instead of a bearer token when given one", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await backendRequest("/auth/refresh", { method: "POST", refreshCookie: "refresh_token=abc" });

    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ headers: expect.objectContaining({ Cookie: "refresh_token=abc" }) }),
    );
  });

  it("appends query params, skipping undefined and empty-string values", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });

    await backendRequest("/products", { query: { q: "filter", page: 2, empty: "", skip: undefined } });

    const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain("q=filter");
    expect(calledUrl).toContain("page=2");
    expect(calledUrl).not.toContain("empty=");
    expect(calledUrl).not.toContain("skip=");
  });
});
