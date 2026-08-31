import { describe, expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { accountFieldError } from "./error-text";

const panel = getDictionary("uz").account.profilePanel;

describe("accountFieldError", () => {
  it("is null when there is no code", () => {
    expect(accountFieldError(panel, undefined)).toBeNull();
    expect(accountFieldError(panel, "")).toBeNull();
  });

  it("translates a known code", () => {
    expect(accountFieldError(panel, "futureDate")).toBe(panel.errorFutureDate);
    expect(accountFieldError(panel, "tooShort")).toBe(panel.errorTooShort);
  });

  it("falls back rather than showing the raw code", () => {
    expect(accountFieldError(panel, "something-new")).toBe(panel.errorRequired);
  });
});
