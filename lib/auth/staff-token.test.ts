import { describe, expect, it } from "vitest";
import { createSessionToken } from "./session-token";
import { createStaffToken, verifyStaffToken } from "./staff-token";

const SESSION = { userId: "usr_1", role: "SELLER", name: "Aziz" } as const;

describe("staff tokens", () => {
  it("round-trips the user, role and name", async () => {
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
    const forged = Buffer.from(JSON.stringify({ sub: "usr_1", role: "DIRECTOR" }))
      .toString("base64url");

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

  it("rejects malformed input", async () => {
    expect(await verifyStaffToken("")).toBeNull();
    expect(await verifyStaffToken("not-a-token")).toBeNull();
  });
});
