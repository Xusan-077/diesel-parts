import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, isLocale, SUPPORTED_LOCALES, switchLocalePath } from "./locales";

describe("locales", () => {
  it("lists uz, ru, en as supported, with uz as default", () => {
    expect(SUPPORTED_LOCALES).toEqual(["uz", "ru", "en"]);
    expect(DEFAULT_LOCALE).toBe("uz");
  });

  it("isLocale accepts only supported locales", () => {
    expect(isLocale("uz")).toBe(true);
    expect(isLocale("ru")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("")).toBe(false);
  });

  it("switchLocalePath replaces the locale segment of a prefixed path", () => {
    expect(switchLocalePath("/uz/products", "en")).toBe("/en/products");
    expect(switchLocalePath("/uz/products/turbo-1", "ru")).toBe("/ru/products/turbo-1");
    expect(switchLocalePath("/uz", "en")).toBe("/en");
  });

  it("switchLocalePath prefixes a path with no locale segment", () => {
    expect(switchLocalePath("/products", "en")).toBe("/en/products");
  });
});
