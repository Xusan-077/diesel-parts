import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/api/backend-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api/backend-client")>(
    "@/lib/api/backend-client",
  );
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("./staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "@/lib/api/backend-client";
// `getStaffUser` is `cache()`-wrapped (zero-arg, so every call within one
// request shares a cache key) — `loadStaffUser` is the same logic, uncached,
// so each `it` below exercises a fresh call instead of the first one's
// memoized result.
import { loadStaffUser as getStaffUser } from "./dal";
import { getStaffSession } from "./staff-session";

const SESSION = {
  role: "DIRECTOR" as const,
  name: "Direktor",
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

describe("getStaffUser", () => {
  it("returns null when there is no session", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null);
    expect(await getStaffUser()).toBeNull();
  });

  it("maps backend/'s /auth/me response onto StaffUser", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue({
      id: "u1",
      name: "Director",
      email: "director@dieselparts.uz",
      role: "DIRECTOR",
      discountLimit: 5,
      isActive: true,
    });

    const user = await getStaffUser();

    expect(user).toEqual({
      id: "u1",
      name: "Director",
      email: "director@dieselparts.uz",
      role: "DIRECTOR",
      discountLimit: 5,
    });
    expect(backendRequest).toHaveBeenCalledWith("/auth/me", { accessToken: "tok" });
  });

  it("falls back to an empty string for an account with no email on file", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue({
      id: "u2",
      name: "Sotuvchi",
      email: null,
      role: "SELLER",
      discountLimit: 0,
      isActive: true,
    });

    expect((await getStaffUser())?.email).toBe("");
  });

  it("returns null for a deactivated account", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue({
      id: "u1",
      name: "Director",
      email: "director@dieselparts.uz",
      role: "DIRECTOR",
      discountLimit: 5,
      isActive: false,
    });

    expect(await getStaffUser()).toBeNull();
  });

  it("degrades to signed-out on a 401 rather than throwing", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Unauthorized", 401, "unauthorized"));

    expect(await getStaffUser()).toBeNull();
  });

  it("rethrows a non-401 backend failure rather than silently signing the user out", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("Down", 503, "unavailable"));

    await expect(getStaffUser()).rejects.toThrow("Down");
  });
});
