import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { BackendApiError, backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { createStaff, listStaff, updateStaff } from "./user-repository";
import type { UserCreateInput, UserUpdateInput } from "@/lib/schemas";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

function createInput(overrides: Partial<UserCreateInput> = {}): UserCreateInput {
  return {
    name: "Vali",
    email: "vali@dieselparts.uz",
    phone: null,
    password: "supersecret",
    role: "SELLER",
    discountLimit: 5,
    ...overrides,
  };
}

function updateInput(overrides: Partial<UserUpdateInput> = {}): UserUpdateInput {
  return {
    name: "Vali",
    phone: null,
    role: "SELLER",
    discountLimit: 5,
    isActive: true,
    ...overrides,
  };
}

describe("user-repository", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
  });

  describe("listStaff", () => {
    it("maps createdAt to a Date and defaults a missing email to an empty string", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        {
          id: "u1",
          name: "Vali",
          email: null,
          phone: "998901234567",
          role: "SELLER",
          isActive: true,
          discountLimit: 5,
          createdAt: "2026-08-01T00:00:00.000Z",
          completedOrders: 3,
        },
      ]);

      const staff = await listStaff();

      expect(backendRequest).toHaveBeenCalledWith("/users", { accessToken: "tok" });
      expect(staff[0].email).toBe("");
      expect(staff[0].createdAt).toBeInstanceOf(Date);
      expect(staff[0].completedOrders).toBe(3);
    });

    it("sorts active-first, then alphabetically -- backend/ has no sort param and defaults to newest first", async () => {
      vi.mocked(backendRequest).mockResolvedValue([
        { id: "u1", name: "Zafar", email: "z@x.uz", phone: null, role: "SELLER", isActive: true, discountLimit: 5, createdAt: "2026-08-03T00:00:00.000Z", completedOrders: 0 },
        { id: "u2", name: "Anvar", email: "a@x.uz", phone: null, role: "SELLER", isActive: false, discountLimit: 5, createdAt: "2026-08-02T00:00:00.000Z", completedOrders: 0 },
        { id: "u3", name: "Bekzod", email: "b@x.uz", phone: null, role: "SELLER", isActive: true, discountLimit: 5, createdAt: "2026-08-01T00:00:00.000Z", completedOrders: 0 },
      ]);

      const staff = await listStaff();

      expect(staff.map((s) => s.id)).toEqual(["u3", "u1", "u2"]);
    });
  });

  describe("createStaff", () => {
    it("normalizes the email and sends null for an empty phone", async () => {
      vi.mocked(backendRequest).mockResolvedValue({ id: "u1" });

      const result = await createStaff(createInput({ email: " Vali@DieselParts.uz " }), "actor-1");

      expect(result).toEqual({ ok: true, id: "u1" });
      expect(backendRequest).toHaveBeenCalledWith("/users", {
        method: "POST",
        accessToken: "tok",
        body: {
          name: "Vali",
          email: "vali@dieselparts.uz",
          phone: null,
          password: "supersecret",
          role: "SELLER",
          discountLimit: 5,
        },
      });
    });

    it("maps a 409 with the duplicate message to duplicate_email", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("Email already registered", 409, "Conflict"),
      );

      expect(await createStaff(createInput(), "actor-1")).toEqual({ ok: false, reason: "duplicate_email" });
    });
  });

  describe("updateStaff", () => {
    it("maps a 404 to not_found", async () => {
      vi.mocked(backendRequest).mockRejectedValue(new BackendApiError("User not found", 404, "Not Found"));

      expect(await updateStaff("missing", updateInput(), "actor-1")).toEqual({ ok: false, reason: "not_found" });
    });

    it("maps the last-director 409 to last_director, not duplicate_email", async () => {
      vi.mocked(backendRequest).mockRejectedValue(
        new BackendApiError("Cannot deactivate the last active director", 409, "Conflict"),
      );

      expect(await updateStaff("dir-1", updateInput({ isActive: false }), "actor-1")).toEqual({
        ok: false,
        reason: "last_director",
      });
    });

    it("sends an explicit null to clear the phone, not omit it", async () => {
      vi.mocked(backendRequest).mockResolvedValue({});

      await updateStaff("u1", updateInput({ phone: null }), "actor-1");

      expect(backendRequest).toHaveBeenCalledWith("/users/u1", {
        method: "PATCH",
        accessToken: "tok",
        body: { name: "Vali", phone: null, role: "SELLER", discountLimit: 5, isActive: true },
      });
    });
  });
});
