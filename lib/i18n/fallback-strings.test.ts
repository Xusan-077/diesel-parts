import { describe, expect, it } from "vitest";
import { getErrorFallbackStrings, getNotFoundStrings } from "./fallback-strings";
import { SUPPORTED_LOCALES } from "./locales";

/*
 * These two screens are the site's only copy that does not come from the
 * dictionaries, which means nothing else fails when a locale is missing here —
 * the visitor just reads Uzbek. So the completeness is asserted instead.
 */
describe("fallback strings", () => {
  it.each(SUPPORTED_LOCALES)("answers the 404 in %s", (locale) => {
    const strings = getNotFoundStrings(locale);

    expect(strings.label.length).toBeGreaterThan(0);
    expect(strings.description.length).toBeGreaterThan(0);
    expect(strings.cta.length).toBeGreaterThan(0);
  });

  it("gives every locale its own words", () => {
    const labels = SUPPORTED_LOCALES.map((locale) => getNotFoundStrings(locale).label);

    expect(new Set(labels).size).toBe(SUPPORTED_LOCALES.length);
  });

  it("falls back to Uzbek for a locale it does not carry", () => {
    // The cookie is visitor-controlled, so an unknown value has to land
    // somewhere readable rather than on `undefined.label`.
    const unknown = getNotFoundStrings("de" as never);

    expect(unknown).toEqual(getNotFoundStrings("uz"));
    expect(getErrorFallbackStrings("de" as never)).toEqual(getErrorFallbackStrings("uz"));
  });
});
