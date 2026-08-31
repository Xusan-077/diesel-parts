import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("./backend-client", async () => {
  const actual = await vi.importActual<typeof import("./backend-client")>("./backend-client");
  return { ...actual, backendRequest: vi.fn() };
});
vi.mock("@/lib/auth/staff-session", () => ({ getStaffSession: vi.fn() }));

import { backendRequest } from "./backend-client";
import { getStaffSession } from "@/lib/auth/staff-session";
import { recordAudit } from "./audit";

const SESSION = {
  role: "DIRECTOR" as const,
  accessToken: "tok",
  refreshToken: "rt",
  accessTokenExpiresAt: Date.now() + 900_000,
};

describe("recordAudit", () => {
  beforeEach(() => {
    vi.mocked(backendRequest).mockReset();
    vi.mocked(getStaffSession).mockReset();
  });

  it("writes to backend/'s POST /audit with the caller's own access token", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockResolvedValue(undefined);

    await recordAudit({
      userId: "u1",
      action: "UPDATE",
      entityType: "Product",
      entityId: "p1",
      before: { price: 10 },
      after: { price: 20 },
    });

    expect(backendRequest).toHaveBeenCalledWith("/audit", {
      method: "POST",
      accessToken: "tok",
      body: {
        action: "UPDATE",
        entityType: "Product",
        entityId: "p1",
        before: { price: 10 },
        after: { price: 20 },
      },
    });
  });

  it("uses an explicit accessToken instead of the staff cookie when given one", async () => {
    vi.mocked(backendRequest).mockResolvedValue(undefined);

    await recordAudit({
      userId: "u1",
      action: "LOGIN",
      entityType: "User",
      entityId: "u1",
      accessToken: "fresh-login-token",
    });

    expect(getStaffSession).not.toHaveBeenCalled();
    expect(backendRequest).toHaveBeenCalledWith("/audit", {
      method: "POST",
      accessToken: "fresh-login-token",
      body: { action: "LOGIN", entityType: "User", entityId: "u1", before: undefined, after: undefined },
    });
  });

  it("never throws when there is no staff session to attribute the write to", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(null);

    await expect(
      recordAudit({ userId: "u1", action: "LOGIN", entityType: "User", entityId: "u1" }),
    ).resolves.toBeUndefined();

    expect(backendRequest).not.toHaveBeenCalled();
  });

  it("never throws when backend/ rejects the write", async () => {
    vi.mocked(getStaffSession).mockResolvedValue(SESSION);
    vi.mocked(backendRequest).mockRejectedValue(new Error("backend down"));

    await expect(
      recordAudit({ userId: "u1", action: "DELETE", entityType: "Product", entityId: "p1" }),
    ).resolves.toBeUndefined();
  });
});
