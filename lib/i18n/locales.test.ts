import { describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  isLocale,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
  parseLocale,
  SUPPORTED_LOCALES,
} from "./locales";

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

  /*
   * `parseLocale` is what both readers of the stored choice go through — the
   * persist `merge` and the server's cookie read — so anything a browser can
   * hand back has to land on a real locale rather than throw.
   */
  it("parseLocale passes supported locales through", () => {
    expect(parseLocale("ru")).toBe("ru");
    expect(parseLocale("en")).toBe("en");
  });

  it("parseLocale falls back to the default for anything else", () => {
    expect(parseLocale("fr")).toBe(DEFAULT_LOCALE);
    expect(parseLocale("")).toBe(DEFAULT_LOCALE);
    expect(parseLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(parseLocale(null)).toBe(DEFAULT_LOCALE);
    expect(parseLocale(7)).toBe(DEFAULT_LOCALE);
  });

  it("pins the names the store and the server agree on", () => {
    expect(LANGUAGE_STORAGE_KEY).toBe("language-storage");
    expect(LANGUAGE_COOKIE).toBe("language");
  });
});
