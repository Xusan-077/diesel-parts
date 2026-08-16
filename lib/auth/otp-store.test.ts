import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_SENDS_PER_WINDOW,
  MAX_VERIFY_ATTEMPTS,
  OTP_LENGTH,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  SEND_WINDOW_MS,
  requestCode,
  resetOtpStore,
  verifyCode,
} from "./otp-store";

const PHONE = "998901234567";
const T0 = 1_700_000_000_000;

/** Requests a code while stepping past the resend cooldown each time. */
function requestAt(time: number) {
  const result = requestCode(PHONE, time);
  if (!result.ok) {
    throw new Error(`expected a code, got ${result.reason}`);
  }
  return result;
}

beforeEach(() => {
  resetOtpStore();
});

describe("requestCode", () => {
  it("returns a numeric code of the configured length", () => {
    const result = requestAt(T0);
    expect(result.code).toMatch(new RegExp(`^\\d{${OTP_LENGTH}}$`));
    expect(result.expiresInSeconds).toBe(OTP_TTL_MS / 1000);
  });

  it("issues different codes on separate requests", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 4; i += 1) {
      codes.add(requestAt(T0 + i * RESEND_COOLDOWN_MS).code);
    }
    // Collisions are possible but four identical codes would mean it is broken.
    expect(codes.size).toBeGreaterThan(1);
  });

  it("blocks a resend inside the cooldown and reports the wait", () => {
    requestAt(T0);
    const result = requestCode(PHONE, T0 + 10_000);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("cooldown");
    expect(result.retryAfterSeconds).toBe(50);
  });

  it("allows a resend once the cooldown has passed", () => {
    requestAt(T0);
    expect(requestCode(PHONE, T0 + RESEND_COOLDOWN_MS).ok).toBe(true);
  });

  it("rate limits after the per-window send budget is spent", () => {
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i += 1) {
      requestAt(T0 + i * RESEND_COOLDOWN_MS);
    }

    const blocked = requestCode(PHONE, T0 + MAX_SENDS_PER_WINDOW * RESEND_COOLDOWN_MS);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) return;
    expect(blocked.reason).toBe("rate_limited");
  });

  it("starts a fresh budget after the window elapses", () => {
    for (let i = 0; i < MAX_SENDS_PER_WINDOW; i += 1) {
      requestAt(T0 + i * RESEND_COOLDOWN_MS);
    }
    expect(requestCode(PHONE, T0 + SEND_WINDOW_MS + 1).ok).toBe(true);
  });

  it("tracks phones independently", () => {
    requestAt(T0);
    expect(requestCode("998911112233", T0).ok).toBe(true);
  });
});

describe("verifyCode", () => {
  it("accepts the issued code", () => {
    const { code } = requestAt(T0);
    expect(verifyCode(PHONE, code, T0 + 1000)).toEqual({ ok: true });
  });

  it("rejects a code for a phone that never requested one", () => {
    expect(verifyCode(PHONE, "123456", T0)).toEqual({ ok: false, reason: "not_found" });
  });

  it("rejects the code once it has expired", () => {
    const { code } = requestAt(T0);
    expect(verifyCode(PHONE, code, T0 + OTP_TTL_MS + 1)).toEqual({
      ok: false,
      reason: "expired",
    });
  });

  it("consumes the code so it cannot be reused", () => {
    const { code } = requestAt(T0);
    expect(verifyCode(PHONE, code, T0 + 1000).ok).toBe(true);
    expect(verifyCode(PHONE, code, T0 + 2000)).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports the remaining attempts on a wrong code", () => {
    const { code } = requestAt(T0);
    const wrong = code === "000000" ? "111111" : "000000";

    const result = verifyCode(PHONE, wrong, T0 + 1000);
    expect(result.ok).toBe(false);
    if (result.ok || result.reason !== "invalid") {
      throw new Error("expected an invalid-code result");
    }
    expect(result.attemptsLeft).toBe(MAX_VERIFY_ATTEMPTS - 1);
  });

  it("locks the code out after too many wrong attempts", () => {
    const { code } = requestAt(T0);
    const wrong = code === "000000" ? "111111" : "000000";

    for (let i = 0; i < MAX_VERIFY_ATTEMPTS - 1; i += 1) {
      verifyCode(PHONE, wrong, T0 + 1000);
    }

    expect(verifyCode(PHONE, wrong, T0 + 1000)).toEqual({
      ok: false,
      reason: "too_many_attempts",
    });
    // Even the correct code no longer works: the entry is gone.
    expect(verifyCode(PHONE, code, T0 + 1000)).toEqual({ ok: false, reason: "not_found" });
  });
});
