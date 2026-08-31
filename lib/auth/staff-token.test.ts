import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { createSessionToken } from "./session-token";
import { accessTokenExpiryMs, createStaffToken, verifyStaffToken } from "./staff-token";

const SESSION = {
  role: "SELLER",
  accessToken: "backend-access-token",
  refreshToken: "backend-refresh-token",
  accessTokenExpiresAt: Date.now() + 15 * 60 * 1000,
} as const;

describe("staff tokens", () => {
  it("round-trips the role and backend token pair", async () => {
    const token = await createStaffToken(SESSION);
    expect(await verifyStaffToken(token)).toEqual(SESSION);
  });

  it("rejects a customer session token signed with the same key", async () => {
    const customerToken = await createSessionToken("998901234567");
    expect(await verifyStaffToken(customerToken)).toBeNull();
  });

  it("rejects a token with a tampered payload", async () => {
    const token = await createStaffToken(SESSION);
    const [header, , signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ role: "DIRECTOR" })).toString("base64url");

    expect(await verifyStaffToken(`${header}.${forged}.${signature}`)).toBeNull();
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createStaffToken(SESSION);
    expect(await verifyStaffToken(`${token}tampered`)).toBeNull();
  });

  it("rejects a role it does not recognise", async () => {
    const token = await createStaffToken({
      ...SESSION,
      role: "ADMIN" as unknown as typeof SESSION.role,
    });
    expect(await verifyStaffToken(token)).toBeNull();
  });

  it("accepts every one of backend/'s five roles", async () => {
    for (const role of ["SUPER_ADMIN", "DIRECTOR", "MANAGER", "SELLER", "VIEWER"] as const) {
      const token = await createStaffToken({ ...SESSION, role });
      expect((await verifyStaffToken(token))?.role).toBe(role);
    }
  });

  it("rejects a payload missing the backend token pair", async () => {
    // A token signed with the right key/audience but the old {sub, role, name}
    // shape — simulates a cookie left over from before this session format
    // changed, which must not be trusted as if it carried a real token pair.
    const { getSecret } = await import("./secret");
    const stale = await new SignJWT({ role: "SELLER", name: "Aziz" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("usr_1")
      .setAudience("diesel-parts:staff")
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(getSecret());

    expect(await verifyStaffToken(stale)).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect(await verifyStaffToken("")).toBeNull();
    expect(await verifyStaffToken("not-a-token")).toBeNull();
  });
});

describe("accessTokenExpiryMs", () => {
  it("reads the exp claim off an unsigned-to-us access token", async () => {
    const { getSecret } = await import("./secret");
    const expSeconds = Math.floor(Date.now() / 1000) + 900;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime(expSeconds)
      .sign(getSecret());

    expect(accessTokenExpiryMs(token)).toBe(expSeconds * 1000);
  });

  it("treats an undecodable token as already expired", () => {
    const before = Date.now();
    const result = accessTokenExpiryMs("not-a-jwt");
    expect(result).toBeGreaterThanOrEqual(before);
    expect(result).toBeLessThanOrEqual(Date.now());
  });
});
