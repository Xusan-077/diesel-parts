import { describe, expect, it } from "vitest";
import {
  extractNationalDigits,
  formatNationalDigits,
  formatPhone,
  isValidPhone,
  maskPhone,
  toCanonicalPhone,
} from "./phone";

describe("extractNationalDigits", () => {
  it("strips the country code however it was typed", () => {
    expect(extractNationalDigits("+998 90 123-45-67")).toBe("901234567");
    expect(extractNationalDigits("998901234567")).toBe("901234567");
    expect(extractNationalDigits("901234567")).toBe("901234567");
    expect(extractNationalDigits("+998(90)123 45 67")).toBe("901234567");
  });

  it("drops anything beyond nine national digits", () => {
    expect(extractNationalDigits("+9989012345679999")).toBe("901234567");
  });

  it("returns an empty string for input with no digits", () => {
    expect(extractNationalDigits("+998 ")).toBe("");
    expect(extractNationalDigits("abc")).toBe("");
  });
});

describe("isValidPhone", () => {
  it("accepts a complete number", () => {
    expect(isValidPhone("+998 90 123-45-67")).toBe(true);
  });

  it("rejects an incomplete number", () => {
    expect(isValidPhone("+998 90 123")).toBe(false);
    expect(isValidPhone("")).toBe(false);
  });
});

describe("toCanonicalPhone", () => {
  it("returns the 12-digit form", () => {
    expect(toCanonicalPhone("+998 90 123-45-67")).toBe("998901234567");
  });

  it("returns null when incomplete", () => {
    expect(toCanonicalPhone("+998 90 12")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("formats progressively as digits are typed", () => {
    expect(formatPhone("")).toBe("+998 ");
    expect(formatPhone("9")).toBe("+998 9");
    expect(formatPhone("90")).toBe("+998 90");
    expect(formatPhone("901")).toBe("+998 90 1");
    expect(formatPhone("90123")).toBe("+998 90 123");
    expect(formatPhone("901234")).toBe("+998 90 123-4");
    expect(formatPhone("9012345")).toBe("+998 90 123-45");
    expect(formatPhone("90123456")).toBe("+998 90 123-45-6");
    expect(formatPhone("901234567")).toBe("+998 90 123-45-67");
  });

  it("is idempotent on an already formatted value", () => {
    expect(formatPhone(formatPhone("901234567"))).toBe("+998 90 123-45-67");
  });
});

describe("formatNationalDigits", () => {
  it("groups the national part as XX XXX XX XX", () => {
    expect(formatNationalDigits("901234567")).toBe("90 123 45 67");
  });

  it("formats progressively and never leaves a trailing separator", () => {
    expect(formatNationalDigits("")).toBe("");
    expect(formatNationalDigits("9")).toBe("9");
    expect(formatNationalDigits("90")).toBe("90");
    expect(formatNationalDigits("90123")).toBe("90 123");
    expect(formatNationalDigits("9012345")).toBe("90 123 45");
  });

  it("strips a country code the user pasted in", () => {
    expect(formatNationalDigits("+998901234567")).toBe("90 123 45 67");
  });

  it("is idempotent", () => {
    expect(formatNationalDigits(formatNationalDigits("901234567"))).toBe("90 123 45 67");
  });
});

describe("maskPhone", () => {
  it("keeps only the operator code and the last two digits", () => {
    expect(maskPhone("998901234567")).toBe("+998 90 ***-**-67");
  });

  it("returns an empty string for an incomplete number", () => {
    expect(maskPhone("99890")).toBe("");
  });
});
