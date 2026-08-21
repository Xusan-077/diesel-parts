// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_LOCALE,
  LANGUAGE_COOKIE,
  LANGUAGE_STORAGE_KEY,
} from "@/lib/i18n/locales";
import { useLanguageStore, writeLanguageCookie } from "./language-store";

/*
 * The language now lives in two places at once: localStorage, which the store
 * owns, and a cookie, which is the only copy a server component can read. What
 * is worth pinning is that they are written together, and that the store still
 * starts on the default so the first client render matches the server HTML.
 */

function readCookie(): string | undefined {
  return document.cookie
    .split("; ")
    .find((pair) => pair.startsWith(`${LANGUAGE_COOKIE}=`))
    ?.split("=")[1];
}

beforeEach(() => {
  localStorage.clear();
  document.cookie = `${LANGUAGE_COOKIE}=; path=/; max-age=0`;
  useLanguageStore.setState({ language: DEFAULT_LOCALE, hydrated: false });
});

describe("the language store", () => {
  it("starts on the default with nothing hydrated", () => {
    expect(useLanguageStore.getState().language).toBe(DEFAULT_LOCALE);
    expect(useLanguageStore.getState().hydrated).toBe(false);
  });

  it("does not read localStorage until it is told to", () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { language: "ru" } }));

    expect(useLanguageStore.getState().language).toBe(DEFAULT_LOCALE);
  });

  it("picks up the persisted language on rehydration", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { language: "en" } }));

    await useLanguageStore.persist.rehydrate();

    expect(useLanguageStore.getState().language).toBe("en");
  });

  it("falls back to the default when the persisted value is not a locale", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify({ state: { language: "fr" } }));

    await useLanguageStore.persist.rehydrate();

    expect(useLanguageStore.getState().language).toBe(DEFAULT_LOCALE);
  });

  it("survives a corrupt entry rather than throwing", async () => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, "{not json");

    await useLanguageStore.persist.rehydrate();

    expect(useLanguageStore.getState().language).toBe(DEFAULT_LOCALE);
  });

  it("writes both localStorage and the cookie when the language changes", () => {
    useLanguageStore.getState().setLanguage("ru");

    expect(useLanguageStore.getState().language).toBe("ru");
    expect(readCookie()).toBe("ru");
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toContain("ru");
  });

  it("writes a cookie the whole site can read", () => {
    writeLanguageCookie("en");

    expect(readCookie()).toBe("en");
  });
});
