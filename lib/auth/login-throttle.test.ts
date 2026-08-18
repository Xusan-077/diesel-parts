import { beforeEach, describe, expect, it } from "vitest";
import {
  LOGIN_WINDOW_MS,
  MAX_LOGIN_ATTEMPTS,
  checkLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
  resetLoginThrottle,
} from "./login-throttle";

const KEY = "director@dieselparts.uz";
const NOW = 1_700_000_000_000;

function failTimes(count: number, now = NOW): void {
  for (let i = 0; i < count; i += 1) {
    recordLoginFailure(KEY, now);
  }
}

describe("login throttle", () => {
  beforeEach(resetLoginThrottle);

  it("allows a first attempt", () => {
    expect(checkLoginAllowed(KEY, NOW)).toEqual({ ok: true });
  });

  it("still allows the attempt that reaches the limit", () => {
    failTimes(MAX_LOGIN_ATTEMPTS - 1);
    expect(checkLoginAllowed(KEY, NOW)).toEqual({ ok: true });
  });

  it("locks out once the limit is reached", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    const result = checkLoginAllowed(KEY, NOW);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBe(LOGIN_WINDOW_MS / 1000);
    }
  });

  it("counts down the retry as the window elapses", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    const result = checkLoginAllowed(KEY, NOW + 60_000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterSeconds).toBe(LOGIN_WINDOW_MS / 1000 - 60);
    }
  });

  it("reopens after the window elapses", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    expect(checkLoginAllowed(KEY, NOW + LOGIN_WINDOW_MS)).toEqual({ ok: true });
  });

  it("starts a fresh window rather than resuming the old count", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    recordLoginFailure(KEY, NOW + LOGIN_WINDOW_MS);
    expect(checkLoginAllowed(KEY, NOW + LOGIN_WINDOW_MS)).toEqual({ ok: true });
  });

  it("clears the count on a successful sign-in", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    clearLoginFailures(KEY);
    expect(checkLoginAllowed(KEY, NOW)).toEqual({ ok: true });
  });

  it("counts each account separately", () => {
    failTimes(MAX_LOGIN_ATTEMPTS);
    expect(checkLoginAllowed("seller@dieselparts.uz", NOW)).toEqual({ ok: true });
  });
});
