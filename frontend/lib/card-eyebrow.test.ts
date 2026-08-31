import { describe, expect, it } from "vitest";
import { cardEyebrow, startsWithBrand } from "./card-eyebrow";

describe("startsWithBrand", () => {
  it("recognises the brand at the head of a catalog name", () => {
    expect(startsWithBrand("CAT 950 transmissiya filtri", "CAT")).toBe(true);
    expect(startsWithBrand("Doosan DX140 dvigatel klapani", "Doosan")).toBe(true);
  });

  it("does not care about case", () => {
    expect(startsWithBrand("cat 950 filtri", "CAT")).toBe(true);
  });

  it("wants a whole word, not a prefix of one", () => {
    // "Caterpillar" is a different word from "Cat", however it starts.
    expect(startsWithBrand("Caterpillar uchun filtr", "Cat")).toBe(false);
  });

  it("is false when the brand appears anywhere but the front", () => {
    expect(startsWithBrand("Yonilg'i filtri, CAT 950", "CAT")).toBe(false);
  });

  it("is false for a brand nobody named", () => {
    expect(startsWithBrand("CAT 950 filtri", "")).toBe(false);
    expect(startsWithBrand("CAT 950 filtri", "   ")).toBe(false);
  });

  it("counts a name that is exactly the brand", () => {
    expect(startsWithBrand("CAT", "CAT")).toBe(true);
  });
});

describe("cardEyebrow", () => {
  it("spends the line on the category when the name already carries the brand", () => {
    expect(cardEyebrow("CAT 950 transmissiya filtri", "CAT", "Transmissiya")).toBe(
      "Transmissiya"
    );
  });

  it("names the brand when the name does not", () => {
    expect(cardEyebrow("Transmissiya filtri 950", "CAT", "Transmissiya")).toBe("CAT");
  });

  it("falls back to the category when there is no brand to name", () => {
    expect(cardEyebrow("Transmissiya filtri", "", "Transmissiya")).toBe("Transmissiya");
  });

  it("returns something for every card, so the line is never missing", () => {
    // The rule the grid depends on: one line, always, whatever the data.
    const cases: [string, string, string][] = [
      ["CAT 950 filtri", "CAT", "Transmissiya"],
      ["950 filtri", "CAT", "Transmissiya"],
      ["950 filtri", "", "Transmissiya"],
    ];
    for (const [name, brand, category] of cases) {
      expect(cardEyebrow(name, brand, category).length).toBeGreaterThan(0);
    }
  });
});
