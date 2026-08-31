import { describe, expect, it } from "vitest";
import { createSessionToken, verifySessionToken } from "./session-token";

const PHONE = "998901234567";

describe("session tokens", () => {
  it("round-trips the phone number", async () => {
    const token = await createSessionToken(PHONE);
    expect(await verifySessionToken(token)).toEqual({ phone: PHONE });
  });

  it("produces a three-part JWT", async () => {
    const token = await createSessionToken(PHONE);
    expect(token.split(".")).toHaveLength(3);
  });

  it("rejects a token with a tampered payload", async () => {
    const token = await createSessionToken(PHONE);
    const [header, , signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ phone: "998900000000" }))
      .toString("base64url");

    expect(await verifySessionToken(`${header}.${forgedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token with a tampered signature", async () => {
    const token = await createSessionToken(PHONE);
    expect(await verifySessionToken(`${token}tampered`)).toBeNull();
  });

  it("rejects malformed input", async () => {
    expect(await verifySessionToken("")).toBeNull();
    expect(await verifySessionToken("not-a-token")).toBeNull();
  });
});
