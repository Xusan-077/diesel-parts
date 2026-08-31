import { describe, expect, it } from "vitest";
import { checkoutFieldError } from "./checkout-error-text";
import uz from "@/dictionaries/uz.json";

const dict = uz.checkout;

describe("checkoutFieldError", () => {
  it("returns null when there is no code", () => {
    expect(checkoutFieldError(dict, undefined)).toBeNull();
  });

  it("maps a known code to its sentence", () => {
    expect(checkoutFieldError(dict, "termsRequired")).toBe(dict.errorTermsRequired);
    expect(checkoutFieldError(dict, "invalidEmail")).toBe(dict.errorInvalidEmail);
    expect(checkoutFieldError(dict, "tooLong")).toBe(dict.errorTooLong);
    expect(checkoutFieldError(dict, "required")).toBe(dict.errorRequired);
  });

  it("falls back to the required wording for an unrecognised code", () => {
    expect(checkoutFieldError(dict, "somethingNew")).toBe(dict.errorRequired);
  });
});
