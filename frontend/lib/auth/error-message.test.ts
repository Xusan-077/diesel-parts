import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { SUPPORTED_LOCALES } from "@/lib/i18n/locales";
import { authErrorMessage } from "./error-message";

const account = getDictionary("uz").account;

describe("authErrorMessage", () => {
  it("interpolates the remaining attempts", () => {
    const message = authErrorMessage(account, { error: "invalid", attemptsLeft: 3 });
    expect(message).toContain("3");
    expect(message).not.toContain("{attempts}");
  });

  it("interpolates the cooldown seconds", () => {
    const message = authErrorMessage(account, { error: "cooldown", retryAfterSeconds: 42 });
    expect(message).toContain("42");
    expect(message).not.toContain("{seconds}");
  });

  it("maps each known error code to its own message", () => {
    const codes = [
      "invalid_phone",
      "invalid_code",
      "expired",
      "too_many_attempts",
      "rate_limited",
      "delivery_failed",
      "no_pending_request",
    ];
    const messages = codes.map((error) => authErrorMessage(account, { error }));
    expect(new Set(messages).size).toBe(codes.length);
  });

  it("falls back to the generic message for unknown or missing codes", () => {
    expect(authErrorMessage(account, {})).toBe(account.errorGeneric);
    expect(authErrorMessage(account, { error: "something_new" })).toBe(account.errorGeneric);
  });

  it("never leaves a placeholder unresolved in any locale", () => {
    for (const locale of SUPPORTED_LOCALES) {
      const dict = getDictionary(locale).account;
      const messages = [
        authErrorMessage(dict, { error: "invalid", attemptsLeft: 2 }),
        authErrorMessage(dict, { error: "cooldown", retryAfterSeconds: 30 }),
      ];
      for (const message of messages) {
        expect(message).not.toMatch(/\{\w+\}/);
      }
    }
  });
});
